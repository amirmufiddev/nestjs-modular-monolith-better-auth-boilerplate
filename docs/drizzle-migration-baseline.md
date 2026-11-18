# Strategi baseline migrasi Drizzle

**Default boilerplate:** satu migrasi baseline di `drizzle/0000_*.sql` (generate dari schema aktif).

**Historis MyApp:** rantai lama dipindah ke `drizzle-legacy/` (0000–0031+ dengan produk, order, whatsapp, dll.) — hanya untuk referensi atau deploy lama, **bukan** untuk DB baru dari template ini.

## Audit singkat

| Kategori         | Contoh migrasi / isi                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| Core / auth      | `0000_*`, tabel Better Auth, org, member                                   |
| Referensi data   | `0003_regional_addresses.sql`                                              |
| Domain historis  | Order, product, customer, driver, inventory (`0004`–`0022` dan seterusnya) |
| Integrasi sample | WhatsApp (`0018`, dll.), AI (`0031_ai_configs_provider_endpoint.sql`)      |

Schema TypeScript aktif diekspor di `src/database/schema/index.ts` — sudah dipangkas untuk boilerplate, tetapi **file SQL historis tetap ada** untuk clone yang menjalankan full chain.

## Opsi A: baseline baru (fork bersih)

**Untuk:** repo template baru tanpa warisan tabel domain.

1. Dump schema hanya tabel yang dipakai core (+ optional yang Anda pilih).
2. Buat migrasi `0000_baseline.sql` baru di fork; arsipkan folder `drizzle/` lama.
3. Reset journal Drizzle (`drizzle/meta/_journal.json`) konsisten dengan baseline.
4. **Risiko:** deploy existing yang sudah punya data **tidak** boleh reset tanpa backup dan rencana cutover.

Perintah umum: `bun run db:generate` setelah edit schema; review SQL manual sebelum apply.

## Opsi B: pertahankan historis (default clone repo)

**Untuk:** developer yang clone repo ini dan ingin DB lengkap tanpa membuat baseline.

1. `bun run db:migrate` — jalankan **seluruh** chain.
2. Tabel domain lama mungkin ada di DB meski modul Nest sudah dihapus; boleh drop manual di fork atau abaikan jika kosong.

**Default untuk new fork yang hanya pakai core:** tetap Opsi B untuk kesederhanaan, lalu pangkas modul di `AppModule` dan dokumentasi tier. Baseline (Opsi A) hanya jika Anda menulis ulang `drizzle/` dari nol.

## Deploy existing MyApp / domain lama

Gunakan **Opsi B** — jangan squash migrasi tanpa maintenance window. Catat versi migrasi terakhir di environment staging sebelum production.

## Tidak dieksekusi otomatis

Plan ini **hanya dokumentasi**. Tidak ada DDL destructive tanpa konfirmasi pemilik data.

Rujuk juga: [`database.md`](./database.md), [`boilerplate-module-tiers.md`](./boilerplate-module-tiers.md).
