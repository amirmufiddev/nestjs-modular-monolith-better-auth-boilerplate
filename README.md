# NestJS 11 REST API Boilerplate

Modular monolith siap produksi: **Fastify**, **Drizzle**, **Better Auth** (multi-org), **RBAC**, health, upload, dan modul referensi **`regional`**.

## Prasyarat

| Dependensi | Catatan |
|------------|---------|
| [Bun](https://bun.sh) **1.3+** | `packageManager` di `package.json` |
| PostgreSQL | `DATABASE_URL` di `.env` |
| Redis | Cache & Better Auth session (`REDIS_*`) |

## Quickstart (dari nol)

```bash
bun install
cp .env.example .env
# Wajib: isi DATABASE_URL, BETTER_AUTH_SECRET (≥32 char), BETTER_AUTH_URL, BETTER_AUTH_CLIENT_URL

bun run db:migrate
# Opsional demo data:
# bun run db:seed
# bun run db:seed:regional
# bun run db:seed:org-members

bun run start:dev
```

| Item | Nilai default |
|------|----------------|
| API base | `http://localhost:2001` |
| Prefix REST | `/v1/...` (lihat `docs/api-conventions.md`) |
| Better Auth | `BETTER_AUTH_PATH` default `/v1/auth` |

## API docs (development only)

Scalar UI dan OpenAPI JSON **hanya** saat `NODE_ENV=development` (`src/main.ts` → `configureOpenApi`).

| URL | Isi |
|-----|-----|
| `http://localhost:2001/docs` | Scalar UI |
| `http://localhost:2001/docs-json` | OpenAPI JSON gabungan |

Produksi: docs **tidak** di-mount. Export JSON manual dari staging/CI jika perlu. CSP Scalar: `src/bootstrap/helmet.config.ts` (jsDelivr).

## Scripts penting

| Script | Fungsi |
|--------|--------|
| `bun run build` | Compile |
| `bun run start:dev` | Watch mode |
| `bun test` | Unit tests (~150+ spec) |
| `bun run lint` | ESLint flat + `modular-monolith/no-cross-module-import` |
| `bun run db:migrate` | Jalankan migrasi Drizzle |
| `bun run db:seed` | Seed demo (tanpa katalog produk domain) |
| `bun run depcheck` | Cek dependency tidak terpakai (setelah pangkas modul) |

## Module tiers

**Core** vs **optional** (payment, notification, whatsapp, AI, queue, FCM): [`docs/boilerplate-module-tiers.md`](docs/boilerplate-module-tiers.md).

Hanya modul **core** di `AppModule` (tanpa payment, notification, WA, AI). Tambah modul via `_template`.

## Mengapa boilerplate ini

Kekuatan yang perlu dipertahankan (path, pola DTO, boundary): [`docs/boilerplate-strengths.md`](docs/boilerplate-strengths.md).

## Modular boundary (ESLint)

Flat config: `eslint.config.mjs`. Rule custom: **`modular-monolith/no-cross-module-import`** — lintas modul hanya via `modules/<name>/api/`. Detail & contoh: [`tools/eslint-rules/README.md`](tools/eslint-rules/README.md).

```bash
bun run lint
```

## Modul baru

Scaffold: salin [`src/modules/_template/`](src/modules/_template/) atau baca [`docs/scaffold-new-module.md`](docs/scaffold-new-module.md). Referensi layering: `src/modules/regional/`.

## Dokumentasi

| Topik | File |
|-------|------|
| Arsitektur | [`docs/architecture.md`](docs/architecture.md) |
| Modular monolith | [`docs/modular-monolith.md`](docs/modular-monolith.md) |
| Auth | [`docs/auth.md`](docs/auth.md) |
| Database & migrasi | [`docs/database.md`](docs/database.md), [`docs/drizzle-migration-baseline.md`](docs/drizzle-migration-baseline.md) |
| Testing | [`docs/testing.md`](docs/testing.md) |
| API conventions | [`docs/api-conventions.md`](docs/api-conventions.md) |
| Env / integrasi opsional | [`docs/configuration-optional-integrations.md`](docs/configuration-optional-integrations.md) |
| Dev & graphify | [`docs/development.md`](docs/development.md) |
| Dependency hygiene | [`docs/dependency-hygiene.md`](docs/dependency-hygiene.md) |

## Uploads

`uploads/` di-gitignore; tidak dibagikan lewat repo (`uploads/.gitkeep`).

## Knowledge graph

Setelah menambah/memindah modul: `graphify update .` — lihat [`docs/development.md`](docs/development.md).

## Stack (ringkas)

NestJS 11, Fastify, Zod env (`src/config/env.validation.ts`), Winston, Drizzle, Better Auth, Redis cache, BullMQ (opsional, default off).