# Modular Monolith — Boilerplate

Satu deployable unit dengan batas modul tegas. Detail anti-pattern: [`anti-patterns-reference.md`](anti-patterns-reference.md#1-direct-cross-module-import).

## Modul default (core)

```text
src/modules/
├── auth/
├── member/
├── rbac/
├── regional/          # referensi CRUD berlapis
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

```text
src/modules/<name>/
├── api/
├── application/
├── domain/            # opsional
├── infrastructure/
├── facade/
└── presentation/
```

Modul lain **hanya** import dari `modules/<name>/api/`. ESLint: `modular-monolith/no-cross-module-import`.

## Komunikasi antar modul

1. **Public API** — Symbol token + facade (`MEMBER_API`, `PAYMENT_API`, …)
2. **Domain events** — `DomainEventMap` di `src/shared/events/domain-event-registry.ts`
3. **Shared kernel** — `src/shared/` (bukan business domain)

## Shared foundation

- `SharedEventsModule`, `RealtimeModule`, `PushNotificationModule`
- `RlsContext` / `RlsInterceptor` untuk organisasi aktif

Rujuk [`src/shared/README.md`](../src/shared/README.md).