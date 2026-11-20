# Modular Monolith — Boilerplate

Satu deployable unit dengan batas modul tegas. Detail anti-pattern: [`anti-patterns-reference.md`](anti-patterns-reference.md#1-direct-cross-module-import).

## Modul default (core)

```text
src/modules/
├── auth/
├── member/
├── rbac/
├── regional/          # referensi CRUD modular idiomatik
├── upload/
├── health/
├── notification/      # sample opsional
├── payment/           # sample opsional
├── email/             # template + pengiriman
└── (auth-related wiring)
```

## Modul sample (opsional)

| Modul | Ukuran kasar | Registrasi |
|-------|----------------|------------|
| `whatsapp/` | Integrasi WAHA, webhook, persistence pesan | Manual import `WhatsappModule` |
| `ai-assistant/` | OpenAI, admin keys, chat stub boilerplate | Manual import `AiAssistantModule` + `aiKeyConfig` |

Lihat [`samples/README.md`](samples/README.md).

## Struktur internal modul

Setiap modul di `src/modules/<nama_modul>/` mengikuti struktur seragam berbasis 5 Prinsip SOLID:

```text
src/modules/<nama_modul>/
├── controllers/          # [SRP] HTTP routing, guards, Swagger
├── services/             # [SRP] Logika bisnis & orkestrasi
├── repositories/         # [SRP & DIP] Akses database Drizzle & query
├── interfaces/           # [ISP & DIP] Kontrak abstraksi & Symbol token
├── dto/                  # [SRP] Validasi payload request & format respons API
├── <nama_modul>.module.ts # [OCP] NestJS Module DI wiring
└── index.ts              # Gerbang publik resmi modul (Boundary Gate)
```

### Batasan Impor Antar Modul (ESLint Boundary)

- **Diizinkan:** Mengimpor dari root modul `src/modules/<name>` (melalui `index.ts`) atau `src/modules/<name>/interfaces`.
- **Dilarang keras:** Mengimpor langsung file di dalam subfolder internal (`controllers/`, `services/`, `repositories/`, `infrastructure/`, `domain/`, `presentation/`, `facade/`, `application/`).
- **Enforcement:** ESLint custom rule `modular-monolith/no-cross-module-import`.

```typescript
// ❌ BAD - Mengimpor langsung dari subfolder internal modul lain
import { MemberRepository } from '../member/repositories/member.repository';
import { MemberService } from '../member/services/member.service';

// ✅ GOOD - Mengimpor via public gate index.ts atau interfaces
import { MemberModule, MemberService } from '@/modules/member';
import { IMemberRepository, MEMBER_REPOSITORY_TOKEN } from '@/modules/member/interfaces';
```

## Komunikasi antar modul

1. **Public Gate (`index.ts`)** — Setiap modul menyediakan `index.ts` sebagai satu-satunya titik akses resmi untuk modul lain (mengekspor Module, Service publik, DTO, dan contracts).
2. **Dependency Inversion (DIP)** — Lapisan persistensi diisolasi di balik interface dan Symbol injection token (`provide: TOKEN, useClass: Repository`), memudahkan mocking dan decoupling.
3. **Domain Events (Asinkron)** — Komunikasi antar modul tanpa kopling langsung menggunakan `EventEmitter2` dengan typed registry `DomainEventMap` di `src/shared/events/domain-event-registry.ts`.
4. **Shared Foundation** — Concern horizontal di `src/shared/` (event bus, RLS context, realtime SSE, FCM push).

## Shared foundation

- `SharedEventsModule`, `RealtimeModule`, `PushNotificationModule`
- `RlsContext` / `RlsInterceptor` untuk organisasi aktif

Rujuk [`src/shared/README.md`](../src/shared/README.md).