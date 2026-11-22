# Design Document: Database Seeder System (Admin, RBAC, Regional)

**Tanggal:** 23 November 2026  
**Status:** Approved  
**Implementasi Target:** `src/database/`

---

## 1. Latar Belakang & Tujuan

Aplikasi memerlukan inisialisasi master data awal (seeding) untuk:
1. **User Admin**: Akun administrator awal dengan role `admin` dan kredensial yang dapat diautentikasi melalui Better Auth (`credential` provider dengan hash `argon2`).
2. **RBAC**: Hak akses bawaan sistem pada tabel `rbac_permission` dan template role bawaan organisasi (`owner`, `admin`, `member`) pada tabel `rbac_role_template`.
3. **Regional**: Master data wilayah Indonesia dan kode pos pada tabel `regional_addresses` (~80.000 baris) dari repository dataset upstream.

Kebutuhan krusial:
- Seed yang **sudah pernah dijalankan tidak boleh dijalankan ulang** saat perintah `bun run db:seed` dieksekusi kembali.
- Menjaga kebersihan arsitektur, modularitas, serta prinsip SOLID (Single Responsibility dan Open/Closed Principle).

---

## 2. Arsitektur Ledger & Runner

### 2.1 Tabel Ledger `_seeds`
Runner memelihara tabel ledger di database PostgreSQL untuk mencatat status eksekusi:

```sql
CREATE TABLE IF NOT EXISTS "_seeds" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "batch" integer NOT NULL,
  "executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

- `name`: Identifier unik seeder (contoh: `'rbac'`, `'admin'`, `'regional'`).
- `batch`: Nomor batch eksekusi yang bertambah (di-increment) setiap kali `bun run db:seed` dijalankan.
- `executed_at`: Timestamp eksekusi seed.

### 2.2 Kontrak Seeder (`src/database/seeds/seeder.interface.ts`)
Setiap modul seeder mengimplementasikan antarmuka standar:

```typescript
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export interface SeederContext {
  db: NodePgDatabase<Record<string, unknown>>;
  pool: Pool;
}

export interface Seeder {
  readonly name: string;
  run(context: SeederContext): Promise<void>;
}
```

### 2.3 Runner CLI (`src/database/seed.ts`)
Runner bertindak sebagai orkestrator:
1. **Koneksi Database**: Inisialisasi PostgreSQL `Pool` dan Drizzle instance menggunakan `env.DATABASE_URL`.
2. **Setup Ledger**: Memastikan tabel `_seeds` ada (`CREATE TABLE IF NOT EXISTS "_seeds"...`).
3. **Pemeriksaan Riwayat**: Mengambil daftar `name` yang telah dieksekusi dari `_seeds`.
4. **Kalkulasi Batch**: Menentukan nomor batch berikutnya: `MAX(batch) + 1` (default `1` jika tabel kosong).
5. **CLI Argumen & Filter**:
   - Mendukung argumen nama seeder spesifik (misal: `bun run src/database/seed.ts admin`).
   - Mendukung flag `--force` untuk memaksa eksekusi ulang seeder yang sudah tercatat di ledger.
   - Tanpa flag `--force`, seeder yang namanya sudah ada di `_seeds` akan di-skip dengan log informatif: `[skip] Seeder "<name>" already executed.`.
6. **Eksekusi Berurutan**:
   - Menjalankan seeder dalam urutan prioritas dependensi:
     1. `rbac`
     2. `admin`
     3. `regional`
   - Setiap seeder yang selesai dengan sukses langsung dicatat ke `_seeds` dalam transaksi database.
   - Jika terjadi kegagalan (exception), proses seeding dihentikan segera dan menampilkan stack trace tanpa mencatat seeder yang gagal ke ledger.
7. **Pembersihan**: Menutup pool koneksi database dengan bersih (`await pool.end()`).

---

## 3. Spesifikasi Detail Tiap Seeder

### 3.1 Seeder RBAC (`src/database/seeds/rbac.seed.ts`)
- **Nama Seeder**: `'rbac'`
- **Tabel Sasaran**:
  - `rbac_permission`:
    - Mengambil katalog permission bawaan dari `BOOTSTRAP_BETTER_AUTH_STATEMENT`:
      - `member`: `['read', 'invite', 'remove', 'update-role']`
      - `ac`: `['create', 'read', 'update', 'delete']`
      - `broadcast`: `['trigger']`
    - Strategi: `ON CONFLICT DO NOTHING` atau cek keberadaan berbasis `(resource, action)` aktif (`deletedAt is null`).
  - `rbac_role_template`:
    - Mengambil template default dari `getDefaultRolePermissions()` dan `getDefaultPermissionScopes()`:
      - Role: `owner`, `admin`, `member`
      - Kolom: `roleName`, `permission` (JSON string), `permissionScopes` (JSON string).
    - Strategi: `ON CONFLICT (role_name) DO UPDATE` agar sinkron dengan template terbaru.

### 3.2 Seeder User Admin (`src/database/seeds/admin.seed.ts`)
- **Nama Seeder**: `'admin'`
- **Tabel Sasaran**: `user` dan `account` (Better Auth)
- **Konfigurasi Kredensial**:
  - `SEED_ADMIN_EMAIL`: Mengambil dari `process.env.SEED_ADMIN_EMAIL` (default: `'admin@example.com'`)
  - `SEED_ADMIN_PASSWORD`: Mengambil dari `process.env.SEED_ADMIN_PASSWORD` (default: `'Admin12345!'`)
  - `SEED_ADMIN_NAME`: Mengambil dari `process.env.SEED_ADMIN_NAME` (default: `'Super Admin'`)
  - `SEED_ADMIN_USERNAME`: Mengambil dari `process.env.SEED_ADMIN_USERNAME` (default: `'admin'`)
  - `SEED_ADMIN_PHONE`: Mengambil dari `process.env.SEED_ADMIN_PHONE` (default: `'+6281234567890'`)
- **Strategi Eksekusi**:
  1. Cek keberadaan user berdasarkan `email` di tabel `user`.
  2. Jika user sudah ada: Log informasi bahwa admin dengan email tersebut telah terdaftar dan skip.
  3. Jika belum ada:
     - Generate `userId = crypto.randomUUID()`.
     - Insert ke tabel `user`:
       - `id: userId`
       - `name: SEED_ADMIN_NAME`
       - `email: SEED_ADMIN_EMAIL`
       - `role: 'admin'`
       - `emailVerified: true`
       - `username: SEED_ADMIN_USERNAME`
       - `phoneNumber: SEED_ADMIN_PHONE`
       - `phoneNumberVerified: true`
     - Hash password menggunakan `argon2` (`await argon2.hash(password)`).
     - Insert ke tabel `account`:
       - `id: crypto.randomUUID()`
       - `accountId: userId`
       - `providerId: 'credential'`
       - `userId: userId`
       - `password: hashedPassword`

### 3.3 Seeder Regional (`src/database/seeds/regional.seed.ts`)
- **Nama Seeder**: `'regional'`
- **Tabel Sasaran**: `regional_addresses`
- **Integrasi**:
  - Menyesuaikan file `src/database/seeds/regional.seed.ts` yang sudah ada agar mengekspor object `regionalSeeder: Seeder`.
  - Fungsi standalone (`bun run src/database/seeds/regional.seed.ts`) tetap didukung dengan pemeriksaan `isDirectExecution()`.
  - Menggunakan transaksi dedikasi dan temporary staging tables (`regional_addresses_tmp` dan `regional_postal_codes_tmp`), serta parsing stream dari dataset remote.

---

## 4. Penyesuaian `package.json`

Memperbaiki path script npm seeder yang usang di `package.json`:
- `"db:seed": "bun run src/database/seed.ts"` (runner utama seluruh seed)
- `"db:seed:regional": "bun run src/database/seeds/regional.seed.ts"` (memperbaiki path lama yang mengarah ke `src/infrastructure/database/...`)

---

## 5. Strategi Pengujian & Verifikasi

1. **Unit Test Runner (`src/database/seed.spec.ts`)**:
   - Memverifikasi pembuatan tabel `_seeds` jika belum ada.
   - Memverifikasi filter seeder: hanya seeder yang belum tercatat di ledger yang dipanggil.
   - Memverifikasi pemakaian flag `--force` yang mengeksekusi ulang seeder yang sudah terdaftar.
   - Memverifikasi eksekusi seeder spesifik melalui argumen CLI.
   - Memverifikasi pencatatan ke ledger setelah seeder berhasil dijalankan.
2. **Unit Test Seeder**:
   - RBAC Seeder (`src/database/seeds/rbac.seed.spec.ts`): Memverifikasi mapping statement dan role templates.
   - Admin Seeder (`src/database/seeds/admin.seed.spec.ts`): Memverifikasi hashing argon2 dan payload insert user/account.
   - Regional Seeder (`src/database/seeds/regional.seed.spec.ts`): Memverifikasi parser SQL literal dan tuple parsing (sudah ada).
3. **Verifikasi Linter & Typecheck**:
   - Memastikan tidak ada pelanggaran ESLint (`bun run lint`).
   - Memastikan build dan test lolos (`bun test`).
