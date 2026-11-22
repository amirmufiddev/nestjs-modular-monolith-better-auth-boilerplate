# Performance — N+1 Query & Eager Loading

Dokumen ini membahas pola-pola query database yang sering menyebabkan masalah performa di backend ini, terutama **N+1 query**.

## Foundation Layer Status (P1)

Foundation Layer P1 sudah ter-deliver. Beberapa implikasi performa utama:

- **`RlsContext` (AsyncLocalStorage) biaya sangat rendah** — `getStore()` di V8 hanya baca dari TLS slot (~50–200ns per call, jauh di bawah `Date.now()` atau syscalls). Memanggil `RlsContext.getCurrentOrganizationId()` di tiap query **tidak** menambah overhead terukur.
- **SSE pub/sub berbasis channel-map (`SseService`)** — `subscribe`/`publishToChannel` O(1) per channel. Biaya memori: 1 `Subject<RealtimeEvent>` per channel aktif, dan 1 entry `organizationAdmins` per organization. Cocok untuk ~ratusan admin concurrent; untuk ribuan, perlu Redis pub/sub.
- **Domain event bus (`@nestjs/event-emitter`)** — in-process, tanpa network hop. Emisi 1 event = sync walk over listener Map di process yang sama. Cocok untuk komunikasi antar-modul dalam monolith; jangan dipakai untuk cross-service (perlu message broker).
- **RLS menggunakan `current_setting('app.current_organization_id')`** — dieksekusi sekali per request (lihat `RlsInterceptor`). Policy `USING (organization_id = current_setting('app.current_organization_id'))` akan memakai **index pada kolom `organization_id`** — pastikan index ada di semua tabel tenant-scoped. Tanpa index, RLS menyaring dengan full-table scan.

Detail: `backend/src/shared/README.md` adalah sumber tunggal pola pemakaian aktual.

## Daftar Isi

- [Apa itu N+1 Query](#-apa-itu-n1-query)
- [Red Flags N+1](#red-flags-n1)
- [Pola Umum N+1](#pola-umum-n1)
- [Solusi di Drizzle ORM](#solusi-di-drizzle-orm)
- [Pattern: Batch & Parallel](#pattern-batch--parallel)
- [Performance Foundation Layer](#performance-foundation-layer)
- [Ceklist Performa Query](#ceklist-performa-query)

---

## Apa itu N+1 Query

N+1 terjadi ketika sebuah endpoint menjalankan **1 query utama + N query tambahan** di dalam loop, di mana N = jumlah baris hasil query utama.

**Contoh dampak:**

| Baris | Query tanpa N+1 | Query dengan N+1 | Rasio |
| ----- | --------------- | ---------------- | ----- |
| 100   | ~5ms            | ~500ms           | 100x  |
| 1000  | ~10ms           | ~5.000ms (5s)    | 500x  |
| 10000 | ~20ms           | ~50.000ms (50s)  | 2500x |

---

## Red Flags N+1

| Pattern                             | Severity    | Example                                         |
| ----------------------------------- | ----------- | ----------------------------------------------- |
| Query dalam `for`/`forEach`/`map`   | 🔴 Critical | `users.map(u => db.getOrders(u.id))`            |
| Lazy loading dalam loop             | 🔴 Critical | `posts.forEach(p => p.comments.load())`         |
| Missing `include`/`join`/`populate` | 🟡 Warning  | Fetch parent tanpa eager load relations         |
| Sequential `await` dalam loop       | 🟡 Warning  | `for (const id of ids) { await fetch(id) }`     |
| Insert satu-satu dalam loop         | 🟡 Warning  | `for (const item of items) await repo.insert()` |

---

## Pola Umum N+1

### Pattern 1: Query dalam Loop

```typescript
// ❌ Bad — N+1 queries (1 + N queries)
const users = await userRepo.findAll();
for (const user of users) {
  user.orders = await orderRepo.findByUserId(user.id); // N queries!
}
```

```typescript
// ✅ Good — Single query dengan join/include
const users = await userRepo.findAll({
  include: [{ model: Order }],
});
```

### Pattern 2: Lazy Loading Trap

```typescript
// ❌ Bad — Lazy loading triggers N queries
const posts = await postRepo.findAll();
for (const post of posts) {
  console.log(post.author.name); // Lazy load triggers query!
}
```

```typescript
// ✅ Good — Eager loading
const posts = await postRepo.findAll({
  relations: ['author'],
});
```

### Pattern 3: Sequential Async dalam Loop

```typescript
// ❌ Bad — Sequential N requests
const results = [];
for (const id of ids) {
  results.push(await api.fetchById(id)); // Blocking!
}
```

```typescript
// ✅ Good — Parallel atau batch
const results = await Promise.all(ids.map((id) => api.fetchById(id)));
// atau
const results = await api.fetchByIds(ids); // Batch endpoint
```

### Pattern 4: Missing Batch Operations

```typescript
// ❌ Bad — Insert satu-satu
for (const item of items) {
  await repo.insert(item); // N insert queries!
}
```

```typescript
// ✅ Good — Bulk insert
await repo.insertMany(items); // 1 query
```

---

## Solusi di Drizzle ORM

Drizzle tidak otomatis melakukan eager loading seperti Prisma. Anda harus **explicit join**.

### Contoh 1: Eager Load dengan `with` (Drizzle relational query)

```typescript
// ❌ Bad — N+1 manual
const orders = await this.db.query.orders.findMany();
for (const order of orders) {
  order.customer = await this.db.query.users.findFirst({
    where: eq(users.id, order.customerId),
  });
}

// ✅ Good — Single query dengan `with`
const orders = await this.db.query.orders.findMany({
  with: {
    customer: true,
    items: {
      with: { product: true },
    },
  },
});
```

### Contoh 2: Batch Find dengan `inArray`

```typescript
// ❌ Bad — sequential
const products = [];
for (const id of productIds) {
  products.push(await this.productRepo.findById(id));
}

// ✅ Good — single query
const products = await this.db
  .select()
  .from(productsTable)
  .where(inArray(productsTable.id, productIds));
```

### Contoh 3: Aggregation (COUNT, SUM) di Database

```typescript
// ❌ Bad — ambil semua lalu hitung di app
const orders = await this.orderRepo.findByCustomerId(customerId);
const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

// ✅ Good — agregasi di DB
const [{ totalSpent }] = await this.db
  .select({ totalSpent: sum(ordersTable.total) })
  .from(ordersTable)
  .where(eq(ordersTable.customerId, customerId));
```

### Contoh 4: Bulk Insert dengan Drizzle

```typescript
// ❌ Bad — insert satu-satu
for (const item of items) {
  await this.db.insert(orderItemsTable).values(item);
}

// ✅ Good — bulk insert dalam satu query
await this.db.insert(orderItemsTable).values(items);
```

---

## Pattern: Batch & Parallel

### Parallel dengan `Promise.all`

```typescript
// ❌ Bad — sequential
const users = [];
for (const id of userIds) {
  users.push(await this.userRepo.findById(id));
}

// ✅ Good — parallel
const users = await Promise.all(
  userIds.map((id) => this.userRepo.findById(id)),
);
```

### Parallel dengan `Promise.allSettled` (tahan error)

```typescript
// ✅ Good — sebagian gagal tidak menggugurkan semua
const results = await Promise.allSettled(
  userIds.map((id) => this.userRepo.findById(id)),
);

const failed = results.filter((r) => r.status === 'rejected');
if (failed.length > 0) {
  this.logger.warn(`Some users failed to load`, { failed: failed.length });
}

const users = results
  .filter((r) => r.status === 'fulfilled')
  .map((r) => (r as PromiseFulfilledResult<User>).value);
```

### Batch Endpoint

Jika ada loop `await fetchById(id)`, buatlah endpoint batch di sisi provider:

```typescript
// Before: client panggil N endpoint
const users = await Promise.all(ids.map((id) => fetch(`/users/${id}`)));

// After: client panggil 1 endpoint batch
const users = await fetch(`/users?ids=${ids.join(',')}`);
```

---

## Performance Foundation Layer

Detail biaya/runtime komponen Foundation Layer P1 yang relevan untuk keputusan performa — lihat juga `backend/src/shared/README.md`.

| Komponen                                                             | Mekanisme                                                                              | Biaya per call          | Kompleksitas                      | Catatan                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `RlsContext.getCurrentOrganizationId()`                              | `AsyncLocalStorage.getStore()` (TLS slot)                                              | ~50–200 ns              | O(1)                              | Overhead di bawah `Date.now()`; aman dipanggil di tiap query tanpa pengukuran                                                       |
| `RlsInterceptor` (per request)                                       | 1x `SET LOCAL app.current_organization_id = '<organization>'` di TX                    | 1 round-trip DB         | O(1)                              | Hanya sekali per request (bukan per query); pastikan TX masih hidup saat query tenant-scoped                                        |
| `SseService.subscribe` / `publishToChannel`                          | `Map<channel, Subject<RealtimeEvent>>` + 1 entry `organizationAdmins` per organization | O(1) per channel        | O(1)                              | Channel unsubscribe: handler `OnModuleDestroy` membersihkan subject. Skala nyaman sampai ~ratusan concurrent admin per organization |
| Domain event bus (`EventEmitter2.emit`)                              | Sync walk over listener Map, in-process                                                | Mikrosekon per listener | O(L) untuk L listener             | Cocok untuk komunikasi antar-modul monolith. Untuk >ratusan listener per event atau lintas proses, pakai message broker             |
| RLS Postgres policy `USING (organization_id = current_setting(...))` | Filter di planner dengan index pada `organization_id`                                  | Sama dengan WHERE biasa | O(log N) dengan index, O(N) tanpa | **WAJIB:** setiap tabel tenant-scoped punya index `organization_id`; tanpa index, policy RLS memaksa full-table scan                |
| `FcmAdapter.sendToToken`                                             | HTTP call ke FCM (lazy-init; no-op jika belum dikonfigurasi)                           | Network-bound           | O(1) per token                    | Saat mengirim ke banyak driver paralel, pakai `Promise.allSettled`; lihat `backend/src/shared/README.md` bagian 4                   |

### Index Wajib untuk Tabel Tenant-Scoped

```sql
-- Pola default: composite index (organization_id, ...) untuk query umum
CREATE INDEX idx_orders_organization_created
  ON orders (organization_id, created_at DESC);

CREATE INDEX idx_inventory_organization_product
  ON inventory (organization_id, product_id);
```

Tanpa index pada kolom `organization_id`, policy RLS akan menyaring dengan **sequential scan** — efeknya query list sederhana menjadi 10–100× lebih lambat seiring membesarnya tabel. Tambahkan index di migrasi bersamaan dengan pembuatan tabel tenant-scoped.

### Dampak Batch Endpoint

Daftar endpoint yang sering terlihat N+1 di foundation layer:

- `GET /orders` — list orders + items + customer → gunakan Drizzle `with` (lihat "Solusi di Drizzle ORM")
- `GET /admin/live` (SSE) — publish event lintas channel → pastikan pakai `publishToOrganizationAdmins` (satu call, multi-channel) alih-alih loop `publishToChannel`
- `notifications.dispatch` — kirim push ke banyak driver → kumpulkan token dulu (`inArray`), `Promise.allSettled` ke `FcmAdapter`

---

## Ceklist Performa Query

Setiap kali menulis kode yang menyentuh database:

- [ ] Tidak ada `await` di dalam `for`/`forEach`/`map` yang melakukan query
- [ ] Relasi yang pasti diakses di-load secara eager (`with` di Drizzle, `include` di Prisma)
- [ ] Filter yang sering dipakai (`where`, `orderBy`) sudah ter-cover index
- [ ] Untuk insert banyak baris, gunakan bulk insert
- [ ] Untuk agregasi (sum/count/avg), dilakukan di DB bukan di app
- [ ] Query paralel menggunakan `Promise.all`/`Promise.allSettled`

### Tools Deteksi

```bash
# Cari await dalam loop
grep -rn "for.*{" src/modules/ | grep -B2 "await"

# Cari pattern findById dalam loop
grep -rn "\.findById\|\.findOne" src/modules/

# Cek log query lambat (jika logging query aktif)
grep -i "slow query" logs/
```

### Performance Testing

Saat membuat endpoint list, uji dengan:

1. Seed 100, 1000, 10.000 data
2. Ukur response time:
   - ≤100ms untuk list ≤100 baris
   - ≤500ms untuk list ≤1000 baris dengan filter
3. Cek jumlah query yang dieksekusi (gunakan `pg_stat_statements` atau query log)

---

## Kapan N+1 Ditoleransi

> N+1 **dapat ditoleransi** ketika:
>
> - N sangat kecil dan tetap (misal: max 5 row per parent)
> - Tidak dipanggil di endpoint traffic tinggi
> - Sudah diukur dan bukan bottleneck
>
> Tapi defaultnya: **cari cara menghindari**, dan ukur dulu sebelum mengklaim aman.

---

## Referensi

- [database.md](./database.md) — Index & constraint untuk performa query
- [clean-code.md](./clean-code.md) — Function complexity & DRY
- [testing.md](./testing.md) — Cara mocking database untuk unit test
