# Security Guidelines

Dokumen ini merangkum standar keamanan yang WAJIB diikuti saat menulis atau me-review kode backend ini.

## Foundation Layer Status (P1)

Foundation Layer P1 sudah ter-deliver. Implikasi keamanan utama:

- **Multi-tenant isolation (RLS):** `RlsInterceptor` (global) mengekstrak `organizationId` dari session dan menyetelnya di `RlsContext` (AsyncLocalStorage). Database Postgres dapat memakai policy `USING (organization_id = current_setting('app.current_organization_id'))` untuk isolasi data per organisasi. **Setiap jalur eksekusi (HTTP/cron/event handler) yang menyentuh tabel dengan policy RLS WAJIB memastikan context sudah ter-set** — lihat `src/shared/README.md` bagian 2.
- **FCM token encryption:** Token push notification harus di-encrypt at rest di kolom `driver_token`. Implementasi penuh akan di-deliver pada Plan P5 Delivery; untuk P1, `DriverTokenRepository` masih stub dan `FcmAdapter` mengirim token plain (lihat warning di `backend/src/shared/README.md` bagian 4).
- **SSE auth guard (PENDING P2):** `SseController` saat ini ter-mount tanpa `@UseGuards()` — sudah ter-identifikasi dalam review P1 dan akan ditambah saat Plan P2.
- **Module isolation enforcement:** ESLint rule custom `modular-monolith/no-cross-module-import` memblokir import langsung entity/infrastructure modul lain. Lihat `backend/src/shared/README.md` bagian 5.
- **No `console.log`:** Gunakan `Logger` (Pino/NestJS) — lihat `backend/docs/logging-observability.md`.
- **No hardcoded secret:** Semua via `ConfigService` + Zod/Joi validation di startup — lihat `backend/docs/configuration.md` (`configuration.mdc`).

Detail: `backend/src/shared/README.md` adalah sumber tunggal pola pemakaian aktual.

## Daftar Isi

- [Security Red Flags](#security-red-flags)
- [Hardcoded Credentials](#hardcoded-credentials)
- [SQL Injection](#sql-injection)
- [Authentication & Authorization](#authentication--authorization)
- [Multi-Tenant Isolation (RLS)](#multi-tenant-isolation-rls)
- [PII & Sensitive Logging](#pii--sensitive-logging)
- [Module Isolation (ESLint)](#module-isolation-eslint)
- [CORS & Transport](#cors--transport)
- [Random & Crypto](#random--crypto)
- [Checklist Security Review](#checklist-security-review)

---

## Security Red Flags

| Pattern                                  | Severity    | Example                                              |
| ---------------------------------------- | ----------- | ---------------------------------------------------- |
| Hardcoded secret/API key                 | 🔴 Critical | `const apiKey = "sk-xxx..."`                         |
| Password/credential di code              | 🔴 Critical | `password = "admin123"`                              |
| Raw SQL string concat                    | 🔴 Critical | `db.query(\`SELECT * FROM users WHERE id='${id}'\`)` |
| Sensitive data di log                    | 🟡 Warning  | `logger.log(user.password)`                          |
| Missing input validation                 | 🟡 Warning  | `req.body` langsung dipakai tanpa validation         |
| Missing auth/guards                      | 🔴 Critical | Endpoint tanpa `@UseGuards()`                        |
| Missing RlsContext.run di background job | 🔴 Critical | Query multi-tenant tanpa tenant context              |
| FCM token disimpan plain text            | 🔴 Critical | Plaintext di kolom `driver_token` (akan di-fix P5)   |
| Permissive CORS                          | 🟡 Warning  | `app.enableCors({ origin: '*' })`                    |
| Eval / unsafe execution                  | 🔴 Critical | `eval(userInput)`                                    |
| Insecure random                          | 🟡 Warning  | `Math.random()` untuk token                          |
| Default value untuk SECRET               | 🔴 Critical | `JWT_SECRET                                          |     | 'default-secret'` |

---

## Hardcoded Credentials

### Aturan Utama

1. **Tidak boleh** ada credential di source code (JWT secret, API key, password, OAuth secret).
2. Semua secret **wajib** di-load dari environment variable via `ConfigService`.
3. Env vars untuk secret **tidak boleh punya default value** — fail-fast jika tidak di-set.
4. Semua env vars wajib dideklarasikan di `.env.example` (tanpa nilai).

### Contoh Salah & Benar

```typescript
// ❌ Bad — Secret di code
const JWT_SECRET = 'my-super-secret-key';
const API_KEY = 'sk-1234567890abcdef';
```

```typescript
// ❌ Bad — Default value untuk secret (security risk!)
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
// Default value membuat app boot dengan secret lemah
```

```typescript
// ✅ Good — Dari environment, fail-fast jika missing
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
```

```typescript
// ✅ Better — Pakai Zod schema validation saat startup
const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  WAHA_API_KEY: z.string().min(16),
});

const env = envSchema.parse(process.env);
```

### Lokasi yang Wajib Diperiksa

```bash
# Cari hardcoded secret
grep -rn "sk-\|sk_\|pk-\|AIza" src/
grep -rn "password\s*=\s*['\"]" src/
grep -rn "apiKey\s*=\s*['\"]" src/
grep -rn "secret\s*=\s*['\"]" src/

# Cari default value untuk env secret
grep -rn "process.env.*||" src/config/
grep -rn "process.env.*?\?" src/config/
```

---

## SQL Injection

### Aturan Utama

1. **Tidak boleh** ada string interpolation ke query SQL mentah.
2. Pakai parameterized query atau ORM yang handle escaping.
3. Drizzle ORM sudah aman secara default — tetap harus hati-hati saat pakai `sql\`\`` template.

### Contoh

```typescript
// ❌ Bad — String interpolation
const users = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

```typescript
// ✅ Good — Parameterized query
const users = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
```

```typescript
// ✅ Good — ORM dengan escaping
const user = await userRepo.findOne({ where: { id: userId } });
```

```typescript
// ✅ Good — Drizzle (aman)
const user = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.id, userId))
  .limit(1);
```

### Drizzle Raw SQL — Hati-hati

```typescript
// ⚠️ Risiko — sql`...` template
import { sql } from 'drizzle-orm';

// ❌ Bad — interpolation langsung ke raw SQL
const userId = req.query.id;
const user = await db.execute(
  sql`SELECT * FROM users WHERE id = ${userId}`, // Interpolated!
);

// ✅ Good — pakai parameter binding
const user = await db.execute(
  sql`SELECT * FROM users WHERE id = ${userId}`, // sql tag aman karena di-wrap jadi parameter
);

// ✅ Better — hindari raw SQL, pakai query builder Drizzle
const user = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.id, userId));
```

---

## Authentication & Authorization

### Aturan

1. **Semua endpoint** (kecuali `/api/v1/auth/*` dan `/health`) WAJIB dilindungi auth. `AuthGuard` dari `@thallesp/nestjs-better-auth` sudah terdaftar global secara default. Gunakan `@AllowAnonymous()` untuk endpoint publik.
2. Authorization per-role menggunakan `@OrgRoles()` atau `@MemberHasPermission()` dari `@thallesp/nestjs-better-auth`.
3. Tidak boleh ada role check manual di tengah business logic — gunakan guard/decorator.
4. Session/cookie Better Auth diverifikasi via guard global, authorization per-role tetap di controller.

### Contoh Salah & Benar

```typescript
// ❌ Bad — Endpoint tanpa role restriction untuk operasi admin
@Controller('admin')
export class AdminController {
  @Get('users')
  getUsers() {
    /* Anyone authenticated can access! */
  }
}
```

```typescript
// ✅ Good — Dengan @OrgRoles decorator
import { Controller, Get } from '@nestjs/common';
import { OrgRoles } from '@thallesp/nestjs-better-auth';

@Controller('admin')
export class AdminController {
  @Get('users')
  @OrgRoles('owner')
  getUsers() {
    /* Only owner */
  }
}
```

```typescript
// ✅ Good — Dengan @MemberHasPermission (lebih granular)
import { Controller, Post } from '@nestjs/common';
import { MemberHasPermission } from '@thallesp/nestjs-better-auth';

@Controller('admin')
export class AdminController {
  @Post('products')
  @MemberHasPermission({ product: ['create'] })
  createProduct() {
    /* Hanya member dengan permission product:create */
  }
}
```

### Yang Wajib Diperiksa Saat Review

- [ ] Setiap endpoint baru punya `@OrgRoles()` atau `@MemberHasPermission()` untuk operasi yang butuh otorisasi
- [ ] Endpoint publik ditandai `@AllowAnonymous()`
- [ ] Tidak ada role check manual seperti `if (user.role !== 'owner') throw ...` di service
- [ ] Endpoint public benar-benar aman untuk dipanggil tanpa auth
- [ ] Resource ownership dicek (contoh: customer hanya bisa lihat order miliknya)

---

## PII & Sensitive Logging

### Data yang Wajib Di-Redact

- Password (plain & hashed)
- Token (JWT, refresh token, API key)
- Session ID / cookie value
- OTP / 2FA code
- Credit card number, CVV
- Alamat detail (opsional, sesuai compliance)

### Aturan Logging

1. Gunakan `Logger.maskToken()` atau redactor saat log API key.
2. `password` tidak boleh masuk ke log dalam bentuk apapun.
3. Email boleh di-log, **TAPI** pertimbangkan untuk masking sebagian (`a***@gmail.com`).
4. Audit log boleh simpan action tanpa data sensitif.

### Contoh

```typescript
// ❌ Bad — Log password/token
logger.log('Login attempt', { email, password });
console.log('Token:', apiKey);
```

```typescript
// ✅ Good — Redact sensitive fields
logger.log('Login attempt', { email });
logger.debug('Token generated', { token: maskToken(apiKey) });
```

### Helper Masking

```typescript
// src/common/utils/mask.ts
export function maskToken(token: string): string {
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2 ? '**' : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}
```

### FCM Push Token Encryption (Wajib di P5)

`FcmAdapter` mengirim push notification ke driver berdasarkan token. Token FCM adalah **identifier sensitif** — bocor ke pihak ketiga bisa dipakai untuk spam atau impersonation push ke device driver.

**Aturan (P5 — Delivery Plan):**

- Kolom `driver_token.token` di tabel `driver_token` **wajib** di-encrypt at rest (AES-256-GCM atau libsodium sealed box).
- Encryption key di-load dari `ConfigService` (`FCM_TOKEN_ENCRYPTION_KEY`), **bukan** di-hardcode.
- Token yang di-log harus di-mask (`maskToken(token)` helper di atas); hanya 4 karakter pertama dan 4 karakter terakhir yang boleh masuk log/observability.
- Key rotation: dukung multi-key dengan `key_version` di schema; saat rotate, decrypt dengan key lama lalu re-encrypt dengan key baru (background job, batched).

```typescript
// ✅ Future implementation (sketsa, bukan API final)
import { encrypt, decrypt } from '@/common/crypto/field-encryption';

const stored = encrypt(
  plainToken,
  configService.get('FCM_TOKEN_ENCRYPTION_KEY'),
);
await this.driverTokenRepo.insert({ driverId, token: stored, keyVersion: 1 });

// Saat kirim
const plain = decrypt(record.token, record.keyVersion);
const ok = await this.fcm.sendToToken(plain, payload);
```

> **Status P1:** `DriverTokenRepository` masih stub (token plain). Implementasi penuh ada di roadmap Plan P5.

---

## CORS & Transport

### Aturan CORS

1. **Production**: CORS origins di-set eksplisit via env `CORS_ORIGINS` (comma-separated).
2. **Tidak boleh** pakai `origin: '*'` di production.
3. Credentials (`credentials: true`) hanya untuk origin yang dipercaya.
4. Helmet WAJIB aktif dengan default secure headers.

### Contoh

```typescript
// ❌ Bad — Wildcard CORS
app.enableCors({ origin: '*' });

// ✅ Good — Whitelist origins
app.enableCors({
  origin: configService.get<string[]>('CORS_ORIGINS', []),
  credentials: true,
});
```

### HTTPS & Cookies

1. Set `cookie.secure: true` di production.
2. Set `cookie.sameSite: 'lax'` atau `'strict'`.
3. `trust proxy` harus diset di balik reverse proxy (sudah diset di Fastify `main.ts`).

---

## Multi-Tenant Isolation (RLS)

Boilerplate ini mendukung multi-tenant (banyak organisasi). Isolasi data **wajib** di-enforce di level database, bukan di level aplikasi saja.

### Mekanisme

1. `RlsInterceptor` (global) membaca `organizationId` dari session (Better Auth) dan menyetel `RlsContext` (AsyncLocalStorage).
2. DB transaction `SET LOCAL app.current_organization_id = '<organizationId>'` dieksekusi per request (lihat `src/shared/database/rls.interceptor.ts`).
3. Postgres policy: `USING (organization_id = current_setting('app.current_organization_id')::uuid)` — query tanpa context yang sesuai **return zero rows** (fail-closed).

### Pola Wajib di Service Layer

```typescript
import { RlsContext } from '@/shared/database/rls-context';

@Injectable()
export class OrderService {
  async findById(orderId: string) {
    // Tidak perlu manual pass organizationId — RLS sudah menyaring di DB
    return this.orderRepo.findOne({ where: { id: orderId } });
  }
}
```

### Pola Wajib di Background Job / Cron

```typescript
import { RlsContext } from '@/shared/database/rls-context';

@Cron('0 * * * *')
async hourlyInventorySync() {
  const orgs = await this.organizationRepo.findAll();
  for (const org of orgs) {
    // WAJIB — kalau tidak dibungkus, query child akan kena RLS deny
    await RlsContext.run(org.id, () => this.memberService.recalculate());
  }
}
```

### Anti-Pattern: Query Tanpa Context

```typescript
// ❌ Bad — cron tanpa RlsContext.run
@Cron('0 * * * *')
async sync() {
  await this.memberRepo.find(); // organization_id = current_setting(...) = NULL → kosong
}
```

```typescript
// ❌ Bad — passing organizationId manual sebagai filter (duplikasi, easy to forget)
async findByOrganization(organizationId: string) {
  return this.memberRepo.find({ where: { organizationId } }); // Bypass RLS defense-in-depth
}

// ✅ Good — RLS adalah single source of truth, kode app tidak filter manual
async find() {
  return this.inventoryRepo.find();
}
```

> **Detail:** Lihat `backend/src/shared/README.md` bagian 2 dan `backend/docs/database.md`.
>
> **Wajib untuk background job / event handler:** jalur eksekusi yang **TIDAK** melalui HTTP interceptor (cron, `@OnEvent` listener, queue worker) **wajib** membungkus query dengan `RlsContext.run(organizationId, () => ...)` — lihat `src/shared/README.md` bagian 2. Mendeteksi via audit: `grep -rn "@Cron\|@OnEvent" src/modules | grep -v "RlsContext"`.

---

## Module Isolation (ESLint)

Modul-modul di arsitektur modular monolith **wajib** terisolasi. ESLint rule `modular-monolith/no-cross-module-import` memblokir pelanggaran di level CI.

### Aturan

- ✅ **BOLEH:** Import dari `modules/<name>` (public `index.ts`) atau `modules/<name>/interfaces`
- ✅ **BOLEH:** Import dalam modul yang sama (mis. `order` internal files saling import)
- ❌ **TIDAK BOLEH:** Import dari subfolder internal modul lain (`controllers/`, `services/`, `repositories/`, `infrastructure/`, `domain/`, dll.)

### Contoh Violation & Fix

```typescript
// ❌ Bad — ESLint error
// di modules/delivery/services/delivery.service.ts
import { OrderRepository } from '../../order/repositories/order.repository';
```

```typescript
// ✅ Good — via public entrypoint index.ts
import { OrderService } from '@/modules/order';
```

### Mengapa Penting untuk Security

- Akses langsung ke internal repository atau entity modul lain memungkinkan bypass authorization layer (mis. bypass multi-tenant check atau field permission).
- Modifikasi internal satu modul tanpa contract testing akan langsung bocor behavior ke modul lain.
- Audit trail compliance lebih mudah — semua cross-module interaction lewat API surface yang bisa di-trace.

> **Catatan:** ESLint rule adalah guardrail, bukan pengganti contract. Pair dengan code review dan module-level integration test.
>
> **Cakupan tambahan:** rule yang sama melarang import langsung `DriverTokenRepository`/`FcmAdapter` dari modul lain — gunakan `PushNotificationModule` API (lihat `src/shared/README.md`). Tujuannya: ciphertext/token hanya keluar lewat satu chokepoint yang bisa di-audit.

---

## Random & Crypto

### Aturan

1. `Math.random()` **TIDAK BOLEH** untuk: token, OTP, session ID, password reset link, dsb.
2. Pakai `crypto.randomUUID()` untuk ID.
3. Pakai `crypto.randomBytes()` untuk raw token (encode ke base64url sebelum dipakai).

### Contoh

```typescript
// ❌ Bad — Math.random untuk token
const token = Math.random().toString(36).substring(2);

// ✅ Good — crypto.randomUUID untuk ID
const id = crypto.randomUUID();

// ✅ Good — crypto.randomBytes untuk token
const token = crypto.randomBytes(32).toString('base64url');
```

---

## Checklist Security Review

Setiap PR yang menyentuh auth/data/endpoint WAJIB melewati checklist ini:

### Credentials

- [ ] Tidak ada hardcoded secret/API key/password di source
- [ ] Semua secret di-load via `ConfigService` dengan Zod validation
- [ ] Tidak ada default value untuk env vars yang berisi secret
- [ ] `.env.example` di-update jika ada env baru

### Input Validation

- [ ] Semua endpoint pakai DTO dengan class-validator
- [ ] `@IsUUID()` untuk ID params
- [ ] `@IsEnum()` untuk field enum
- [ ] `@Min`/`@Max` untuk numeric field
- [ ] `forbidNonWhitelisted: true` aktif di `ValidationPipe`

### Auth & Authz

- [ ] Endpoint baru punya `@OrgRoles()` atau `@MemberHasPermission()` untuk otorisasi
- [ ] Endpoint publik ditandai `@AllowAnonymous()`
- [ ] Role check dilakukan via decorator, bukan manual `if`
- [ ] Resource ownership dicek (customer hanya akses miliknya)

### SQL & DB

- [ ] Tidak ada string interpolation di raw SQL
- [ ] Drizzle query menggunakan helper (`eq`, `inArray`, dsb.)
- [ ] Soft delete ter-apply untuk query `findAll`

### Multi-Tenant (RLS)

- [ ] Background job / cron / event handler yang query tabel RLS dibungkus `RlsContext.run(...)`
- [ ] HTTP path diasumsikan sudah ter-handle `RlsInterceptor`; jika ada endpoint yang skip, dokumentasikan alasannya
- [ ] Tidak ada filter manual `where: { organizationId }` di repository — RLS adalah single source of truth
- [ ] Migrasi DB baru yang menambah tabel tenant-scoped menyertakan policy RLS

### FCM / Push

- [ ] Token FCM di-encrypt at rest (P5 — saat ini stub)
- [ ] Token FCM di-mask saat di-log
- [ ] `FCM_PRIVATE_KEY` di-load via `ConfigService`, tidak pernah di-hardcode

### SSE / Realtime

- [ ] Endpoint SSE memakai guard (P2 — saat ini `SseController` belum pakai `@UseGuards`)
- [ ] Channel subscription di-validate terhadap `organizationId` user (admin channel A tidak boleh dapat event organization B)

### Module Isolation

- [ ] Tidak ada import langsung ke subfolder internal modul lain (`controllers/`, `services/`, `repositories/`, dll.) (ESLint `no-cross-module-import` enforce)
- [ ] Cross-module interaction via `modules/<name>` (`index.ts`) atau `modules/<name>/interfaces` (atau async event bus)

### Logging

- [ ] Tidak ada `console.log` di production code — pakai `Logger` (Pino/NestJS) dengan level (`debug`/`log`/`warn`/`error`)
- [ ] Tidak ada password/token/API key di log
- [ ] Email di-mask jika diperlukan
- [ ] Log error tidak bocorkan stack trace ke client (di production)

### CORS & Transport

- [ ] CORS origins whitelist (bukan `*`)
- [ ] Cookie secure & sameSite diset
- [ ] HTTPS di production

---

## Referensi

- [deployment.md](./deployment.md) — Env vars & secrets management
- [api-conventions.md](./api-conventions.md) — Error envelope & validation
- [auth.md](./auth.md) — Better Auth & role matrix
- [`backend/src/shared/README.md`](../src/shared/README.md) — Foundation Layer: RLS, SSE, FCM, event bus, ESLint rule
