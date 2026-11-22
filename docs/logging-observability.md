# Logging & Observability

Standar logging, correlation ID, log levels, metrics, dan health check untuk backend ini.

## Foundation Layer Status (P1)

Foundation Layer P1 sudah ter-deliver. Implikasi logging & observability utama:

- **Pino structured JSON logger** — output JSON per entry (timestamp, level, msg, context, correlationId, dsb.); siap ingest ke Loki/Elasticsearch. Hindari formatter ad-hoc yang menulis string biasa karena sulit di-query.
- **Domain event correlation via `withMetadata()`** — saat emit/listen domain event (lihat `backend/src/shared/README.md` bagian 1), gunakan helper metadata `withMetadata()` untuk menempelkan `correlationId`, `organizationId`, `actorId` ke payload event. Memudahkan trace lintas-modul tanpa harus coupling ke `requestContextStorage`.
- **Module isolation:** log hanya dari **modul pemilik**. Satu modul **tidak boleh** meng-inspect internal state modul lain (termasuk untuk kepentingan log). Contoh: module `audit` boleh log event `order.created` yang diterima via `@OnEvent`, tapi **tidak boleh** import `OrderEntity` untuk log field internal.
- **Correlation ID via `AsyncLocalStorage`** — pola `getCorrelationId()` (lihat sub-bab "Pakai AsyncLocalStorage") tersedia di foundation; pakai helper ini, jangan membaca `req.correlationId` manual di service layer yang tidak punya akses request object.
- **Tidak ada `console.log`** — pakai Pino/NestJS `Logger` dengan level; lihat juga `backend/src/shared/README.md` untuk komponen foundation yang sudah ter-wired.

Detail: `backend/src/shared/README.md` adalah sumber tunggal pola pemakaian aktual.

## Daftar Isi

- [Observability Red Flags](#observability-red-flags)
- [Logger Standar](#logger-standar)
- [Correlation ID](#correlation-id)
- [Log Levels yang Konsisten](#log-levels-yang-konsisten)
- [Log Sampling](#log-sampling)
- [Health Checks](#health-checks)
- [Metrics & Telemetry](#metrics--telemetry)
- [Distributed Tracing](#distributed-tracing)
- [Audit Log vs Application Log](#audit-log-vs-application-log)
- [Checklist Observability](#checklist-observability)

---

## Observability Red Flags

| Pattern                          | Severity      | Impact                                              |
| -------------------------------- | ------------- | --------------------------------------------------- |
| `console.log` di production code | 🟡 Warning    | No log levels, no aggregation                       |
| Missing correlation ID           | 🟡 Warning    | Hard to trace across services                       |
| Log tanpa context                | 🟡 Warning    | `logger.log('Error')` tanpa info                    |
| Inconsistent log levels          | 🟡 Warning    | `logger.error` untuk info, `logger.log` untuk error |
| Log tanpa sampling               | 🟢 Suggestion | High-volume logs bisa overwhelm storage             |
| Missing health checks            | 🟡 Warning    | No way to detect degraded state                     |
| Missing metrics                  | 🟡 Warning    | No visibility ke performance                        |
| Log PII tanpa masking            | 🔴 Critical   | GDPR violation                                      |

---

## Logger Standar

Backend ini menggunakan **Pino** logger dengan output **structured JSON**. Setiap entry adalah satu baris JSON yang memuat `timestamp`, `level`, `msg`, `context`, `correlationId`, dan key metadata tambahan — siap di-ingest ke aggregator (Loki/Elasticsearch) tanpa perlu parser ad-hoc.

### Cara Pakai

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { getCorrelationId } from '@/common/context/request-context';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(dto: CreateUserDto): Promise<User> {
    // Pakai Pino/NestJS Logger — output JSON terstruktur:
    // {"level":"info","timestamp":"...","context":"UserService.create",
    //  "correlationId":"...","userId":"...","msg":"User created"}
    this.logger.log({
      msg: `Creating user with email ${dto.email}`,
      context: 'UserService.create',
      correlationId: getCorrelationId(),
    });

    try {
      const user = await this.userRepo.save(dto);
      this.logger.log({
        msg: 'User created successfully',
        context: 'UserService.create',
        userId: user.id,
        correlationId: getCorrelationId(),
      });
      return user;
    } catch (error) {
      this.logger.error(
        {
          msg: `Failed to create user: ${error.message}`,
          context: 'UserService.create',
          correlationId: getCorrelationId(),
        },
        error.stack,
      );
      throw error;
    }
  }
}
```

### Anti-Pattern: console.log

```typescript
// ❌ Bad — console.log
@Injectable()
export class UserService {
  async create(dto: CreateUserDto) {
    console.log('Creating user:', dto); // Tidak ada level
    const user = await this.userRepo.save(dto);
    console.log('User created:', user); // Tidak ada correlation ID
    return user;
  }
}
```

```typescript
// ✅ Good — Logger dengan level & context
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(dto: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user ${dto.email}`, {
      context: 'UserService.create',
    });
    // ...
  }
}
```

---

## Correlation ID

Setiap request WAJIB punya **correlation ID** yang:

1. Di-generate di middleware jika tidak ada di header
2. Disimpan di request object (`req.correlationId`)
3. Dikirim balik ke client via header response (`x-correlation-id`)
4. Disertakan di SETIAP log entry
5. Di-propagate ke downstream HTTP call

### Middleware

```typescript
// src/common/middleware/correlation-id.middleware.ts
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

### Logging Interceptor

```typescript
// src/common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const correlationId = req.correlationId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log({
            correlationId,
            method: req.method,
            url: req.url,
            statusCode: context.switchToHttp().getResponse().statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id,
          });
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            correlationId,
            method: req.method,
            url: req.url,
            duration: `${duration}ms`,
            error: err.message,
          });
        },
      }),
    );
  }
}
```

### Propagate ke Downstream Call

```typescript
// Saat panggil service eksternal
async syncOrderToExternal(order: Order) {
  const response = await fetch(externalUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': this.requestContext.correlationId, // ← propagated
    },
    body: JSON.stringify(order),
  });
  // ...
}
```

### Pakai AsyncLocalStorage (Opsional)

Untuk propagasi correlation ID tanpa harus inject manual:

```typescript
// src/common/context/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  correlationId: string;
  userId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getCorrelationId(): string {
  return requestContextStorage.getStore()?.correlationId ?? 'unknown';
}

// Set di middleware
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    requestContextStorage.run({ correlationId }, () => next());
  }
}
```

### Propagate via Domain Event (Lintas Modul)

Untuk propagasi `correlationId` (dan metadata lain seperti `organizationId`, `actorId`) ke listener di **modul lain** tanpa coupling langsung, gunakan `withMetadata()` ketika emit event — lihat `backend/src/shared/README.md` bagian 1.

```typescript
// Producer (modul order)
this.events.emit(
  'order.created',
  withMetadata(orderCreatedPayload, {
    correlationId: getCorrelationId(),
    organizationId: RlsContext.getCurrentOrganizationId(),
    actorId: session.user.id,
  }),
);

// Listener (modul audit, di proses yang sama)
@OnEvent('order.created')
async handle(payload: EventPayload<'order.created'>) {
  // payload.correlationId, payload.organizationId, payload.actorId tersedia
  this.logger.log('Audit received order.created', { correlationId: payload.correlationId });
}
```

---

## Log Levels yang Konsisten

| Level     | Kapan                                                                   |
| --------- | ----------------------------------------------------------------------- |
| `error`   | Error aktual yang memerlukan intervensi (uncaught exception, 5xx)       |
| `warn`    | Recoverable warning, hal yang perlu diperhatikan (4xx, retry, fallback) |
| `log`     | Info umum operasional (request, job, lifecycle)                         |
| `debug`   | Info debugging (SQL, payload, internal state)                           |
| `verbose` | Trace sangat detail (function call, args)                               |

### Contoh Penggunaan Benar

```typescript
// ✅ Good — Correct level usage
this.logger.log('User created'); // Info umum
this.logger.warn('Cache miss, falling back to DB'); // Recoverable
this.logger.error('Payment failed', stackTrace); // Actual error
this.logger.debug('SQL query', { sql, params }); // Debug info
this.logger.verbose('Function called', { args }); // Verbose trace
```

### Anti-Pattern

```typescript
// ❌ Bad — Wrong levels
this.logger.error('User created successfully'); // Should be log()
this.logger.log('Payment failed!'); // Should be error()
```

---

## Log Sampling

Untuk high-volume log (misal: webhook per detik), sampling wajib untuk menghindari storage blow-up.

```typescript
// ❌ Bad — Log every request (storage blow up)
this.logger.log('Request received', { body });

// ✅ Good — Sample for high-volume logs
if (Math.random() < 0.01) {
  // 1% sampling
  this.logger.debug('Request received (sampled)', { requestId });
}
// Always log errors & warnings, only sample info
```

**Aturan**:

- Error: SELALU log (jangan sample)
- Warning: SELALU log
- Info: sample 1-5% untuk high-volume endpoint
- Debug: sample 1% atau off di production

---

## Health Checks

WAJIB punya **liveness** (apakah proses hidup?) dan **readiness** (apakah siap layani request?) yang terpisah.

### Pattern di NestJS

```typescript
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    // private redis: MicroserviceHealthIndicator,
  ) {}

  @Get('liveness')
  @HealthCheck()
  liveness() {
    return this.health.check([() => ({ app: () => ({ status: 'up' }) })]);
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      // () => this.redis.pingCheck('redis'),
      // () => this.external.pingCheck('payment-api'),
    ]);
  }
}
```

### Perbedaan Liveness vs Readiness

| Endpoint     | Pertanyaan                                | Kegagalan                            |
| ------------ | ----------------------------------------- | ------------------------------------ |
| `/liveness`  | "Apakah proses NestJS berjalan?"          | Restart pod                          |
| `/readiness` | "Apakah dependency (DB, Redis, dll.) OK?" | Cabut dari load balancer (sementara) |

### Detail

- `/liveness` HANYA cek proses — JANGAN cek DB. Kalau DB down, pod harus tetap hidup.
- `/readiness` cek dependency. Kalau DB down, cabut dari LB agar tidak menerima traffic baru.

---

## Metrics & Telemetry

### Counter & Histogram

```typescript
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class OrderService {
  private readonly ordersProcessed = new Counter({
    name: 'orders_processed_total',
    help: 'Total orders processed',
    labelNames: ['status'],
  });

  private readonly orderProcessingDuration = new Histogram({
    name: 'order_processing_duration_seconds',
    help: 'Order processing duration',
    labelNames: ['status'],
    buckets: [0.1, 0.5, 1, 2, 5],
  });

  async processOrder(orderId: string) {
    const stopTimer = this.orderProcessingDuration.startTimer();

    try {
      // ... business logic ...
      this.ordersProcessed.inc({ status: 'success' });
    } catch (error) {
      this.ordersProcessed.inc({ status: 'failure' });
      throw error;
    } finally {
      stopTimer({ status: 'success' });
    }
  }
}
```

### Metric yang Berguna untuk Monitor

| Metric                                    | Tipe      | Label                 |
| ----------------------------------------- | --------- | --------------------- |
| `http_requests_total`                     | Counter   | method, route, status |
| `http_request_duration_seconds`           | Histogram | method, route         |
| `orders_processed_total`                  | Counter   | status                |
| `order_processing_duration_seconds`       | Histogram | status                |
| `db_query_duration_seconds`               | Histogram | operation, table      |
| `cache_hits_total` / `cache_misses_total` | Counter   | cache_key             |
| `queue_jobs_total`                        | Counter   | queue, status         |
| `queue_job_duration_seconds`              | Histogram | queue                 |

---

## Distributed Tracing

Untuk cross-service trace (kalau ke depan ada microservice), pakai **OpenTelemetry**:

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('app-backend');

async function processOrder(orderId: string) {
  return tracer.startActiveSpan('processOrder', async (span) => {
    span.setAttribute('orderId', orderId);

    try {
      const order = await this.orderRepo.findById(orderId);
      span.setAttribute('customerId', order.customerId);

      await this.paymentService.charge(order);
      span.addEvent('payment-charged');

      await this.fulfillmentService.ship(order);
      span.addEvent('order-shipped');

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

---

## Audit Log vs Application Log

| Tipe            | Tujuan                               | Disimpan di             | Retention            |
| --------------- | ------------------------------------ | ----------------------- | -------------------- |
| Application log | Debug, observability, error tracking | File (Pino JSON rotate) | 14-30 hari           |
| Audit log       | Compliance, security investigation   | DB (`trx_audit_log`)    | Permanen / 1-5 tahun |
| Error log       | Error tracking + aggregation         | Sentry / setara         | 90 hari              |

### Audit Log Pattern

Audit log ditulis oleh modul `audit` dengan cara menerima event dari modul lain — **tidak ada** import langsung.

```typescript
// src/modules/audit/audit.service.ts
@Injectable()
export class AuditService {
  @OnEvent('audit.entity_changed')
  async handleAuditEvent(payload: AuditEntityChangedEvent) {
    await this.auditRepo.insert({
      action: payload.action,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      actorId: payload.actorId,
      correlationId: payload.correlationId,
      timestamp: new Date(),
    });
  }
}
```

Producer (di module lain) — pakai `EventEmitter2` inject dengan type-safe registry (lihat `backend/src/shared/README.md` bagian 1):

```typescript
// TIDAK import AuditService langsung
// Inject EventEmitter2 dari @nestjs/event-emitter, BUKAN this.eventEmitter
constructor(private readonly events: EventEmitter2) {}

this.events.emit('audit.entity_changed', {
  action: 'order.created',
  resourceType: 'Order',
  resourceId: order.id,
  actorId: dto.actorId,
  correlationId: getCorrelationId(),
});
```

**Type-safety:** Daftarkan shape payload di `DomainEventMap` (`backend/src/shared/events/domain-event-registry.ts`) sehingga emit/listen:typecheck-nya konsisten lintas modul. Lihat juga `backend/src/shared/README.md` bagian 1 untuk `EventPayload<'audit.entity_changed'>`.

---

## Checklist Observability

### Logging

- [ ] Tidak ada `console.log` di production code
- [ ] Pakai `Logger` dari NestJS atau Winston dengan level
- [ ] Setiap log entry punya context (class.method, correlationId, IDs)
- [ ] Tidak ada password/token/API key di log
- [ ] Email di-mask jika perlu

### Checklist Correlation ID

- [ ] Correlation ID di-generate jika tidak ada di header
- [ ] Correlation ID diset di response header
- [ ] Correlation ID dipakai di setiap log entry
- [ ] Correlation ID di-propagate ke downstream call

### Levels

- [ ] `error` untuk actual error
- [ ] `warn` untuk recoverable warning
- [ ] `log` untuk info umum
- [ ] `debug`/`verbose` di-disable di production

### Sampling

- [ ] High-volume endpoint (webhook, dll.) punya sampling
- [ ] Error & warning TIDAK di-sample

### Checklist Health Checks

- [ ] `/health/liveness` — hanya cek proses
- [ ] `/health/readiness` — cek DB, Redis, dependency lain
- [ ] Health endpoint return detail status per dependency

### Metrics

- [ ] Counter untuk events (orders, payments, notifications)
- [ ] Histogram untuk durations (request, query, processing)
- [ ] Labels untuk filtering (status, queue, route)

### Audit

- [ ] Action penting di-emit via `EventEmitter2.emit('audit.*')` (lihat `backend/src/shared/README.md` bagian 1)
- [ ] AuditService listen via `@OnEvent` (decoupled)
- [ ] Audit log simpan correlationId untuk cross-reference dengan app log

### Module Isolation (Cross-cutting)

- [ ] Log hanya dari modul pemilik — tidak ada modul yang men-log internal state modul lain, bahkan untuk observability
- [ ] Cross-module correlation via event payload (`withMetadata()`) atau `getCorrelationId()`, bukan via import langsung
- [ ] Lihat `backend/src/shared/README.md` bagian 5 untuk daftar guardrail modular

---

## Referensi

- [security-guidelines.md](./security-guidelines.md) — PII masking di log
- [error-handling.md](./error-handling.md) — Error log correlation
- [architecture.md](./architecture.md) — Middleware & interceptor global
