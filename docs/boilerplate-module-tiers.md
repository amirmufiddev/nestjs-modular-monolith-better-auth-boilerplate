# Tier modul: Core vs Optional

## Core (default `AppModule`)

| Modul                         | Path                                                      |
| ----------------------------- | --------------------------------------------------------- |
| Auth + Better Auth org        | `src/modules/auth/`                                       |
| Member                        | `src/modules/member/`                                     |
| RBAC                          | `src/modules/rbac/`                                       |
| Regional (referensi layering) | `src/modules/regional/`                                   |
| Upload                        | `src/modules/upload/`                                     |
| Email                         | `src/modules/email/`                                      |
| Health                        | `src/modules/health/`                                     |
| Shared kernel                 | `src/shared/` (`events`, `realtime`, `push-notification`) |

## Tidak termuat di repo default

Payment, notification, WhatsApp, AI — tambahkan dari nol via [`src/modules/_template/`](../src/modules/_template/) atau salin dari histori git jika diperlukan.

## Database

Migrasi baseline tunggal: `drizzle/0000_boilerplate_baseline.sql` (13 tabel). Historis MyApp: `drizzle-legacy/`.

## Memutuskan fork minimal

1. Pertahankan import di `src/app.module.ts` apa adanya.
2. `bun run db:migrate` pada **database baru**.
3. `bun run depcheck` setelah menambah dependency modul baru — lihat [`dependency-hygiene.md`](./dependency-hygiene.md).
