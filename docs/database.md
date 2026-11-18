# Database — Best Practice

Dokumen ini menjelaskan struktur konvensi skema, dan praktik terbaik untuk performa & integritas data.

## Status Foundation Layer

**P1 selesai.** Foundation database menyediakan `RlsContext` berbasis `AsyncLocalStorage` dan `RlsInterceptor` global untuk membawa tenant context per request. Implementasi, contoh pemakaian, dan catatan integrasi tersedia di [`src/shared/README.md`](../src/shared/README.md).

`RlsContext` menyimpan ID organisasi aktif sebagai context aplikasi. Ia tidak menggantikan predicate/query policy PostgreSQL secara otomatis; repository dan schema tetap wajib menerapkan `organization_id`/tenant filter sesuai desain data dan migration.

## Daftar Isi

- [Koneksi & Pool](#koneksi--pool)
- [Konvensi Tabel](#konvensi-tabel)
- [Best Practice Schema](#best-practice-schema)
- [Indexed Columns](#indexed-columns)
- [Foreign Key Constraints](#foreign-key-constraints)
- [RLS Context & Tenant Isolation](#rls-context-tenant-isolation)
- [Soft Delete](#soft-delete)
- [Composite Indexes](#composite-indexes)
- [Migration Hygiene](#migration-hygiene)
- [Schema Red Flags](#schema-red-flags)
- [Checklist Schema](#checklist-schema)

---

## Koneksi & Pool

Database PostgreSQL. Connection string via `DATABASE_URL` env var. Pool di-share antara Drizzle ORM dan Better Auth melalui `getSharedPool()` di `src/database/database.constants.ts`.

### Detail

- Driver: `pg` (node-postgres) via `postgres-js` driver Drizzle
- SSL: aktif jika `DATABASE_SSL=true` (wajib di production cloud DB)
- Pool size: di-tune via env atau default Postgres

---

## Konvensi Tabel

| Prefix  | Kategori                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------- |
| `mst_`  | Master data (produk)                                                                                    |
| `trx_`  | Transaksional (order, stok, loyalty, balance)                                                           |
| `auth_` | Tabel Better Auth: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation` |

### Naming

- Snake_case untuk nama tabel dan kolom
- Singular noun untuk tabel master (`mst_product`, `mst_customer`)
- Tabel transaksional deskriptif (`trx_order`, `trx_order_item`)
- Plural untuk tabel junction (`order_items`)
- UUID primary key untuk hampir semua tabel kecuali beberapa lookup

---

## RLS Context & Tenant Isolation

Setiap request tenant-aware membawa organisasi aktif dari sesi Better Auth. `RlsInterceptor` yang dipasang global di `src/main.ts` membaca `request.session.session.activeOrganizationId`, lalu menjalankan handler di dalam `RlsContext` berbasis `AsyncLocalStorage`. Dengan begitu service/repository dapat mengambil context saat runtime tanpa meneruskan ID tenant melalui setiap signature.

```typescript
import { RlsContext } from '@/shared/database/rls-context';

const organizationId = RlsContext.getCurrentOrganizationId();
if (!organizationId) {
  throw BusinessError.unauthorized(
    'Tenant context tidak tersedia',
    'TENANT_CONTEXT_REQUIRED',
  );
}

// Predicate tenant tetap eksplisit pada query/repository.
const orders = await orderRepository.findByOrganization(organizationId);
```

Aturan penggunaan:

- Jangan mengambil `organizationId` dari body/query sebagai sumber otoritas ketika request sudah memiliki session context.
- Jangan mengasumsikan context ada di luar request; background job dan test harus memakai `RlsContext.run(organizationId, callback)` secara eksplisit.
- `getCurrentOrganizationId()` mengembalikan `string | null`; repository harus menangani context yang tidak tersedia secara typed, bukan diam-diam mengambil seluruh tenant.
- Context aplikasi dan PostgreSQL RLS policy adalah dua lapisan berbeda. Saat policy database diterapkan, nilai context harus di-bind ke mekanisme session/transaction database secara eksplisit; P1 saat ini menyediakan context helper/interceptor, bukan implementasi policy SQL otomatis.
- Kolom tenant (`organization_id`, atau nama domain yang disepakati) harus di-index bersama predicate yang paling sering digunakan.

Contoh context manual untuk test atau job terisolasi:

```typescript
await RlsContext.run('org-123', async () => {
  await orderService.rebuildDailySummary();
});
```

Lihat [`src/shared/README.md`](../src/shared/README.md) untuk API `run()` dan perilaku nested context.

### Indexed Columns

```typescript
// ❌ Bad — Query email frequently, no index
@PrimaryGeneratedColumn('uuid')
id: string;

@Column()
email: string; // Often queried by email!
```

```typescript
// ✅ Good — Indexes on queryable columns
@Index(['email'], { unique: true })
@Index(['createdAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @CreateDateColumn()
  createdAt: Date;
}

// Drizzle equivalent
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('uq_users_email').on(table.email),
    createdAtIdx: index('idx_users_created_at').on(table.createdAt),
  }),
);
```

### Foreign Key Constraints

```typescript
// ❌ Bad — FK without constraint
@Column()
userId: string; // No constraint, can reference non-existent user
```

```typescript
// ✅ Good — FK with constraint + cascade rule
@ManyToOne(() => User, (user) => user.posts, {
  onDelete: 'CASCADE',  // or 'RESTRICT', 'SET NULL'
  nullable: false,
})
@JoinColumn({ name: 'user_id' })
user: User;

// Drizzle equivalent
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});
```

### Pilih `onDelete` dengan Benar

| Rule        | Kapan                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| `CASCADE`   | Child tidak ada artinya tanpa parent (misal: order items, session)     |
| `RESTRICT`  | Parent tidak boleh dihapus selama ada child (misal: user dengan order) |
| `SET NULL`  | Opsional relasi; parent hilang = relasi jadi null (misal: assignedTo)  |
| `NO ACTION` | Default; sama dengan RESTRICT di Postgres                              |

---

## Base Repository & Soft Delete

Gunakan `BaseRepository` untuk standar operasi CRUD. Gunakan **soft delete** (kolom `deleted_at`) untuk data yang perlu di-recover atau audit. Hindari campuran hard delete & soft delete.

### Pattern Base Repository & Soft Delete

```typescript
// src/database/schema/_base.ts — base columns
export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // nullable, default null = not deleted
};

// Schema
export const orders = pgTable('trx_order', {
  ...baseColumns,
  // ...
});

// Implementasi Repository
import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from '../../common/repository/base.repository';
import { DRIZZLE } from '../../database/database.constants';
import { orders } from '../../database/schema/order';

@Injectable()
export class OrderRepository extends BaseRepository<typeof orders> {
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, orders);
  }
}

// Penggunaan di Service
export class OrderService {
  constructor(private orderRepo: OrderRepository) {}

  async fetchAll() {
    // Otomatis mem-filter deletedAt IS NULL jika tabel mendukungnya
    return this.orderRepo.findAll();
  }

  async fetchPaginated(page: number, limit: number) {
    // Otomatis mengeksekusi data query dan count query secara paralel
    const offset = (page - 1) * limit;
    return this.orderRepo.findPaginated({ limit, offset });
  }

  async softDelete(id: string) {
    // Otomatis men-set deletedAt ke new Date() alih-alih hard delete
    await this.orderRepo.delete(id);
  }
}
```

### Keunggulan BaseRepository

- **Soft Delete Otomatis**: Jika schema mendefinisikan kolom `deletedAt`, metode `findAll`, `findPaginated`, `findCount`, dan `findById` secara otomatis mengeksklusikan data yang terhapus. Metode `delete` otomatis melakukan soft delete.
- **Transaksi**: Sebagian besar method menerima parameter opsional `tx` (transaction object) sehingga bisa diikutsertakan dalam `db.transaction(async (tx) => { ... })`.
- **Parallel Pagination**: `findPaginated` menjalankan operasi fetching data dan counting rows serentak (melalui `Promise.all`), menghindari N+1 query issue pada perhitungan pagination total.

### Tabel yang Wajib Soft Delete

- `trx_order`, `trx_order_item`, `trx_payment` — data historis
- `mst_customer`, `mst_customer_address` — data pribadi
- `mst_product` — produk yang dihapus tapi ada di order history (perlu `isActive` atau `deletedAt`)
- Semua tabel dengan audit requirement

### Hard Delete — Hanya Untuk

- Session expired
- Test fixtures
- GDPR right-to-be-forgotten (explicit request)

---

## Composite Indexes

```typescript
// ❌ Bad — Two single indexes, but query uses both
@Index(['userId'])
@Index(['status'])
// Query: WHERE user_id = ? AND status = ?
// → Uses only one index, scans other

// ✅ Good — Composite index matches query
@Index(['userId', 'status'])
// Query: WHERE user_id = ? AND status = ?
// → Uses both, fast lookup

// Note: order matters!
// @Index(['userId', 'status']) for WHERE userId = ? AND status = ?
// @Index(['userId', 'status']) for WHERE userId = ? (also works)
// @Index(['userId', 'status']) for WHERE status = ? (DOES NOT work efficiently)
```

### Drizzle Composite Index

```typescript
(table) => ({
  userStatusIdx: index('idx_orders_user_status').on(table.userId, table.status),
});
```

---

## Migration Hygiene

### Aturan Wajib

1. **Tidak boleh** edit schema langsung di production tanpa migration
2. Selalu generate migration file sebelum deploy
3. Migration harus **additive** (tidak drop kolom tanpa backup)
4. Test rollback di staging sebelum apply ke production

### Workflow

```bash
# 1. Edit schema (src/database/schema/*.ts)
# 2. Generate migration
bun run db:generate --name add_user_phone

# 3. Review file di src/database/migrations/<timestamp>_add_user_phone.sql
# 4. Commit file migration + schema

# 5. CI check
bun run db:migrate --dry-run

# 6. Production deploy
bun run db:migrate
```

### Yang Dilarang

```bash
# ❌ DILARANG — bypass migration
psql -c "ALTER TABLE users ADD COLUMN phone VARCHAR(20);"

# ❌ DILARANG — edit migration yang sudah di-apply
# Buat migration baru untuk perubahan selanjutnya
```

### Pattern Migration Aman

```sql
-- ✅ Additive change dengan default value
ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL;

-- ✅ Backfill data setelah kolom ditambah
UPDATE users SET phone = 'unknown' WHERE phone IS NULL;

-- ✅ Add NOT NULL constraint setelah backfill
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
```

---

## Schema Red Flags

| Pattern                     | Severity      | Impact                         |
| --------------------------- | ------------- | ------------------------------ |
| Query tanpa index           | 🔴 Critical   | Full table scan, O(n)          |
| Missing FK constraint       | 🔴 Critical   | Orphan rows, inconsistent data |
| No unique constraint        | 🟡 Warning    | Duplicate data allowed         |
| Soft delete inconsistency   | 🟡 Warning    | Mix hard/soft delete           |
| Missing migration           | 🔴 Critical   | Schema drift, deploy fails     |
| Large TEXT column di index  | 🟡 Warning    | Slow indexing                  |
| Nullable column tanpa logic | 🟢 Suggestion | Tambah notNull atau default    |
| Denormalized tanpa reason   | 🟡 Warning    | Update anomaly                 |

---

## Deteksi Schema Issue

```bash
# Cari kolom yang sering di-WHERE tapi tidak ada index
grep -rn "where(" src/modules/ | grep -v "deletedAt\|id"

# Cari FK tanpa onDelete di Drizzle schema
grep -rn "references(" src/database/schema/ | grep -v "onDelete"

# Cari tabel tanpa deletedAt (untuk tabel transaksional)
grep -rn "pgTable" src/database/schema/
```

```bash
graphify query "find tables without soft delete column"
graphify query "find foreign keys without onDelete rule"
graphify query "find frequently queried columns without indexes"
```

---

## Performance Tuning Tips

1. **Partial Index** untuk query dengan filter umum:

```sql
CREATE INDEX idx_orders_pending ON trx_order(customer_id)
WHERE status = 'pending' AND deleted_at IS NULL;
```

1. **Covering Index** untuk query yang hanya butuh beberapa kolom:

```sql
CREATE INDEX idx_orders_summary ON trx_order(customer_id, status, total);
```

1. **Connection pooling** — pool size default Postgres = 100. Tune via env.

2. **Query plan analysis** — aktifkan `EXPLAIN ANALYZE` di log untuk slow queries.

---

## Checklist Schema

Setiap PR yang mengubah schema WAJIB memenuhi:

### Indexes

- [ ] Kolom yang sering di-WHERE punya index (single atau composite)
- [ ] Kolom yang sering di-ORDER BY punya index
- [ ] Foreign keys selalu di-index

### Constraints

- [ ] Setiap FK punya `onDelete` rule yang eksplisit
- [ ] Kolom `unique` pakai `uniqueIndex` (bukan hanya `unique: true` di kolom)
- [ ] NOT NULL atau DEFAULT value untuk kolom baru

### Soft Delete

- [ ] Tabel transaksional punya `deletedAt` (atau `isActive`)
- [ ] Repository method filter `deletedAt IS NULL` di default query
- [ ] Ada method `softDelete` dan `hardDelete` (untuk GDPR)

### Migration

- [ ] Migration file di-generate (`bun run db:generate`)
- [ ] Migration di-review manual sebelum di-commit
- [ ] Perubahan additive (tidak drop kolom tanpa backup data)
- [ ] Migration di-test di staging sebelum production

---

## Seed & CLI logging

Script di `database/seeds/` boleh memakai `console.log` untuk progres (jumlah baris, file yang diimpor, dll.) karena dijalankan manual/CI sebagai CLI, bukan sebagai request runtime. Di application layer (`src/`), gunakan `AppLoggerService` — lihat anti-pattern logging di [`anti-patterns-reference.md`](./anti-patterns-reference.md).

---

## Migrasi & baseline

Rantai file `drizzle/` historis vs baseline fork bersih: [`drizzle-migration-baseline.md`](./drizzle-migration-baseline.md).

---

## Referensi

- [performance-n-plus-one.md](./performance-n-plus-one.md) — N+1 patterns & query optimization
- [deployment.md](./deployment.md) — DATABASE_URL configuration
- [architecture.md](./architecture.md) — Database module & shared pool
