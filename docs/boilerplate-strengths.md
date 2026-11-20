# Kekuatan Boilerplate (yang perlu dipertahankan)

Daftar ini menjadi checklist saat menambah modul atau fork repo. Jangan menghapus pola berikut tanpa pengganti setara.

## Stack & bootstrap

| Kekuatan | Contoh path |
|----------|-------------|
| NestJS 11 + Fastify | `src/main.ts`, `src/bootstrap/cors.config.ts`, `src/bootstrap/helmet.config.ts` |
| Validasi env terpusat (Zod) | `src/config/env.validation.ts`, `src/config/app.config.ts` |
| ConfigModule ter-load eksplisit | `src/app.module.ts` (`validate`, `load: [appConfig, ...]`) |

## Global cross-cutting

| Kekuatan | Contoh path |
|----------|-------------|
| Filter exception terpadu | `src/common/filters/all-exceptions.filter.ts` |
| Logging request | `src/common/interceptors/logging.interceptor.ts` |
| Response envelope | `src/common/interceptors/response-envelope.interceptor.ts` |
| Correlation ID | `src/common/middleware/correlation-id.middleware.ts` |
| RLS / tenant context | `src/shared/database/rls.interceptor.ts`, `src/shared/database/rls-context.ts` |

## Auth, org, RBAC

| Kekuatan | Contoh path |
|----------|-------------|
| Better Auth + multi-org | `src/modules/auth/auth.ts`, `src/modules/auth/auth.module.ts` |
| RBAC | `src/modules/rbac/` |
| Member / invitation | `src/modules/member/` |

## Data & errors

| Kekuatan | Contoh path |
|----------|-------------|
| Drizzle + shared pool | `src/database/database.module.ts`, `src/database/database.constants.ts` |
| Base repository pattern | `src/common/repositories/base.repository.ts` (dan modul yang extend) |
| Typed business errors | `src/common/errors/business-error.ts` |

## Observability & health

| Kekuatan | Contoh path |
|----------|-------------|
| Winston logger | `src/logger/logger.service.ts`, `src/logger/logger.module.ts` |
| Health + Redis | `src/modules/health/` |
| Prometheus metrics | `src/infrastructure/metrics/metrics.module.ts` |

## Modular monolith

| Kekuatan | Contoh path |
|----------|-------------|
| Referensi layering penuh (SOLID) | `src/modules/regional/` (`controllers/`, `services/`, `repositories/`, `interfaces/`, `dto/`, `index.ts`) |
| Boundary ESLint | `eslint.config.mjs`, `tools/eslint-rules/no-cross-module-import.mjs` |
| Shared kernel (bukan domain) | `src/shared/README.md` |

## Testing & DX

| Kekuatan | Contoh path |
|----------|-------------|
| Bun test + alias `@/` | `package.json` (`jest` config), `test/setup.ts` |
| `.env.example` lengkap | `.env.example` |
| Seed/migrate tanpa `console.log` di `src/` | `database/seeds/`, `src/database/migrate.ts` |

## Pola wajib untuk modul baru

Saat menambah modul bisnis, patuhi:

1. **Response DTO** — controller mengembalikan DTO, bukan entity Drizzle mentah ([`docs/api-conventions.md`](./api-conventions.md)).
2. **Soft delete** — kolom `deletedAt` + filter default di repository ([`docs/database.md`](./database.md)).
3. **Typed errors** — `BusinessError.*`, jangan `throw new Error('...')` ([`docs/error-handling.md`](./error-handling.md)).
4. **Boundary modul** — konsumsi lintas modul hanya via root `modules/<name>` (gate `index.ts`) atau `interfaces` ([`docs/anti-patterns-reference.md`](./anti-patterns-reference.md#1-direct-cross-module-import)).
5. **Env** — tidak baca `process.env` di service; gunakan `ConfigService` / config factory ([`docs/deployment.md`](./deployment.md)).

Scaffold baru: [`src/modules/_template/README.md`](../src/modules/_template/README.md).