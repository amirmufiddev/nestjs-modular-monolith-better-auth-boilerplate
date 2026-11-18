# Shared Layer — Foundation Layer

Folder ini berisi **shared kernel** boilerplate NestJS — komponen infrastruktur dan utilitas yang dipakai lintas modul dalam arsitektur modular monolith.

## 📁 Struktur

```
shared/
├── events/              # Domain event bus (in-process via @nestjs/event-emitter)
│   ├── shared-events.module.ts
│   ├── domain-event.base.ts
│   ├── domain-event-registry.ts
│   └── *.spec.ts
├── database/            # Multi-tenant RLS context
│   ├── rls-context.ts            # AsyncLocalStorage helper
│   ├── rls.interceptor.ts        # NestJS interceptor (auto-set per request)
│   └── *.spec.ts
├── realtime/            # Server-Sent Events untuk admin live monitor
│   ├── sse.service.ts
│   ├── sse.controller.ts
│   ├── realtime.module.ts
│   ├── sse.constants.ts
│   └── *.spec.ts
└── push-notification/   # FCM adapter untuk driver push notif
    ├── fcm.adapter.ts            # Lazy-init, no-op jika FCM belum dikonfigurasi
    ├── driver-token.repository.ts # Stub (akan di-extend saat Plan P5 Delivery)
    ├── push-notification.module.ts
    └── *.spec.ts
```

---

## 🚀 Cara Pakai

### 1. Domain Event Bus

Event bus menggunakan `@nestjs/event-emitter` dengan wildcard support untuk komunikasi antar modul tanpa coupling langsung.

#### Emit Domain Event

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

constructor(private readonly events: EventEmitter2) {}

// Emit event
this.events.emit('order.created', { 
  orderId: 'o-123', 
  organizationId: 'org-456', 
  customerId: 'c-789' 
});
```

#### Listen Domain Event

```typescript
import { OnEvent } from '@nestjs/event-emitter';

@OnEvent('order.created')
async handleOrderCreated(payload: { orderId: string; organizationId: string }) {
  // Handle event logic
  this.logger.log(`Order created: ${payload.orderId}`);
}

// Wildcard listener (untuk logging/monitoring)
@OnEvent('order.*')
async handleAllOrderEvents(payload: unknown) {
  this.logger.debug('Order event received', payload);
}
```

#### Type-Safe Event Registry

Extend interface `DomainEventMap` di modul Anda untuk type safety:

```typescript
// Di modul order/domain/events/order.events.ts
declare module '@/shared/events/domain-event-registry' {
  interface DomainEventMap {
    'order.created': OrderCreatedEvent;
    'order.confirmed': OrderConfirmedEvent;
  }
}

// Gunakan dengan type inference
import { EventPayload } from '@/shared/events/domain-event-registry';

type OrderCreatedPayload = EventPayload<'order.created'>;
```

---

### 2. Multi-Tenant RLS (Row Level Security)

RLS Context menggunakan `AsyncLocalStorage` untuk menyimpan `organizationId` per-request tanpa harus pass parameter di setiap fungsi.

#### Get Current Organization ID

```typescript
import { RlsContext } from '@/shared/database/rls-context';

// Di dalam request handler
const organizationId = RlsContext.getCurrentOrganizationId();
if (!organizationId) {
  throw new UnauthorizedError('No active organization context');
}

// Gunakan untuk filter query
const orders = await this.orderRepo.find({
  where: { organizationId },
});
```

#### Manual Run Context (untuk testing/background jobs)

```typescript
import { RlsContext } from '@/shared/database/rls-context';

// Jalankan callback dengan organization context tertentu
const result = RlsContext.run('org-123', () => {
  // Semua fungsi dalam scope ini mendapat organizationId = 'org-123'
  return this.orderService.processOrder('o-456');
});
```

#### Auto-Set via Interceptor

RLS Interceptor otomatis mengekstrak `organizationId` dari session dan set context:

```typescript
import { UseInterceptors } from '@nestjs/common';
import { RlsInterceptor } from '@/shared/database/rls.interceptor';

@Controller('orders')
@UseInterceptors(RlsInterceptor)  // Akan auto-set organizationId dari session
export class OrderController {
  @Get()
  async list() {
    const organizationId = RlsContext.getCurrentOrganizationId();
    return this.orderService.findByOrganization(organizationId);
  }
}
```

---

### 3. Server-Sent Events (SSE) untuk Realtime

SSE Service menyediakan publish-subscribe pattern untuk streaming event realtime ke admin dashboard.

#### Subscribe ke SSE (Frontend)

```typescript
// Di frontend (React/Vue/vanilla JS)
const eventSource = new EventSource('/api/realtime/sse/user-123');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Realtime event:', data);
  // Update UI
};

eventSource.onerror = (error) => {
  console.error('SSE connection error', error);
  eventSource.close();
};
```

#### Publish Event ke Admin (Backend)

```typescript
import { SseService } from '@/shared/realtime/sse.service';

constructor(private readonly sse: SseService) {}

// Publish ke specific channel
publishOrderUpdate(userId: string, orderId: string) {
  this.sse.publishToChannel(`admin:${userId}`, {
    type: 'order.status_changed',
    data: { orderId, newStatus: 'confirmed' },
    timestamp: Date.now(),
  });
}

// Publish ke semua admin di organisasi tertentu
notifyOrganizationAdmins(organizationId: string, message: string) {
  this.sse.publishToOrganizationAdmins(organizationId, {
    type: 'organization.notification',
    data: { message },
    timestamp: Date.now(),
  });
}
```

#### Channel Format

- `admin:userId` — personal channel untuk user tertentu
- `admin:userId:organizationId` — admin channel dengan organization context
- `org:organizationId:admin` — organization-wide admin broadcast

#### Health Check

```bash
curl http://localhost:3000/api/realtime/health
# Response: { "status": "ok", "activeConnections": 5 }
```

---

### 4. Firebase Cloud Messaging (FCM) Push Notification

FCM Adapter menyediakan lazy-init push notification dengan graceful degradation (no-op jika FCM tidak dikonfigurasi).

#### Send Push Notification

```typescript
import { FcmAdapter } from '@/shared/push-notification/fcm.adapter';

constructor(private readonly fcm: FcmAdapter) {}

async notifyDriver(driverToken: string, orderId: string) {
  if (!this.fcm.isEnabled()) {
    this.logger.warn('FCM not configured, skipping push notification');
    return;
  }

  const success = await this.fcm.sendToToken(driverToken, {
    title: 'Pesanan Baru',
    body: `Anda mendapat pesanan #${orderId}`,
    data: {
      orderId,
      action: 'view_order',
    },
  });

  if (!success) {
    this.logger.error(`Failed to send FCM to driver token ${driverToken}`);
  }
}
```

#### Configuration (Environment Variables)

```bash
# .env
FCM_CREDENTIALS_PATH=keys/service-account.json
```

Jika `FCM_CREDENTIALS_PATH` kosong atau file JSON tidak valid, FCM akan log warning dan berjalan dalam **no-op mode** (tidak throw error).

---

### 5. ESLint Custom Rule: `no-cross-module-import`

ESLint rule custom untuk enforce modular monolith architecture — mencegah import langsung antar modul di layer `infrastructure/` atau `domain/`.

#### Aturan

- ✅ **BOLEH:** Import dari `modules/<name>/api/` (public API modul)
- ✅ **BOLEH:** Import dalam modul yang sama (`order` import dari `order/domain/`)
- ❌ **TIDAK BOLEH:** Import dari `modules/<other>/infrastructure/` atau `modules/<other>/domain/`

#### Contoh Violation

```typescript
// ❌ BAD - di modules/delivery/application/delivery.service.ts
import { OrderEntity } from '../../order/infrastructure/order.entity';

// ESLint error:
// Cross-module import detected: '../../order/infrastructure/order.entity'.
// Modul hanya boleh consume modul lain via 'modules/<name>/api/'.
```

#### Contoh yang Benar

```typescript
// ✅ GOOD - gunakan public API
import { OrderApiService } from '@/modules/order/api/order-api.service';

constructor(private readonly orderApi: OrderApiService) {}

async getOrderDetails(orderId: string) {
  return this.orderApi.getOrderById(orderId);
}
```

#### Aktivasi di ESLint Config

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['custom-rules'],
  rules: {
    'custom-rules/no-cross-module-import': 'error',
  },
};
```

---

## 🚨 Aturan Penggunaan

### WAJIB

1. **Event-Driven Communication:** Gunakan event bus untuk komunikasi antar modul (hindari direct coupling)
2. **Type Safety:** Extend `DomainEventMap` untuk semua custom events
3. **RLS Context:** Selalu validasi `RlsContext.getCurrentOrganizationId()` di service layer
4. **Graceful Degradation:** FCM dan SSE harus handle kasus disabled/no-op tanpa crash

### TIDAK BOLEH

1. ❌ Import langsung dari `modules/<name>/infrastructure/` atau `modules/<name>/domain/` (gunakan `api/`)
2. ❌ Modify business logic modul dari shared layer (shared hanya infrastruktur)
3. ❌ Hardcode FCM credentials di kode (gunakan env variables)
4. ❌ Fire-and-forget async event handler tanpa error handling
5. ❌ Publish SSE event tanpa cek active subscriber (akan log warning, bukan error)

### Best Practices

- **Event Naming:** Gunakan format `module.action` (e.g., `order.created`, `delivery.assigned`)
- **Event Payload:** Sertakan minimal `id`, `timestamp`, dan `traceId` untuk observability
- **RLS Propagation:** Untuk background jobs, manual set context via `RlsContext.run()`
- **SSE Cleanup:** Frontend harus close EventSource saat component unmount
- **FCM Token Management:** Update token di repository saat driver login/logout

---

## 📊 Testing

Semua komponen shared layer dilengkapi unit test (`*.spec.ts`):

```bash
# Run shared layer tests
npm test -- shared/

# Run specific component tests
npm test -- shared/events
npm test -- shared/database
npm test -- shared/realtime
npm test -- shared/push-notification
```

---

## 📚 Referensi

- Event Bus: [@nestjs/event-emitter docs](https://docs.nestjs.com/techniques/events)
- RLS Pattern: [Node.js AsyncLocalStorage](https://nodejs.org/api/async_hooks.html#class-asynclocalstorage)
- SSE: [Server-Sent Events spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- FCM: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- Modular Architecture: `.cursor/rules/modular-architecture.mdc`

---

**Last Updated:** 2026-07-27
**Plan Reference:** [P1 Foundation Layer](../../docs/superpowers/plans/2026-07-26-p1-foundation-layer.md)
