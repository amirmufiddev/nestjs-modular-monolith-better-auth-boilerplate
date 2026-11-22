# Autentikasi — Better Auth

## Foundation Layer Status (P1)

Foundation Layer P1 sudah selesai. Integrasi Better Auth menggunakan plugin `organization()` untuk multi-tenant; session membawa `activeOrganizationId` yang dipetakan sebagai `organization_id` pada konteks data. `RlsInterceptor` mengekstrak nilai tersebut dari session dan mengisinya ke `AsyncLocalStorage` melalui `RlsContext`. Detail implementasi aktual tersedia di [`src/shared/README.md`](../src/shared/README.md).

## Overview

Backend menggunakan [Better Auth](https://better-auth.com) via `@thallesp/nestjs-better-auth`. Autentikasi mendukung:

- Email + password (argon2 hashing)
- Google OAuth (opsional, via env vars)
- Bearer token (HMAC signed, untuk API key)
- Session cookie

## Konfigurasi

File: `src/auth/auth.ts`

Better Auth diinisialisasi sebagai module-level singleton dan menggunakan shared pg Pool yang sama dengan Drizzle ORM (via `getSharedPool()`).

## Session Lifecycle

| Setting      | Nilai   | Keterangan                                        |
| ------------ | ------- | ------------------------------------------------- |
| `expiresIn`  | 7 hari  | Maksimum lifetime session                         |
| `updateAge`  | 1 hari  | Rolling window — session di-renew jika user aktif |
| Cookie cache | 5 menit | Cache session di cookie untuk mengurangi DB hit   |

## Role Matrix

Roles dikelola Better Auth `organization` plugin. Setiap user bisa join satu `organization` dengan satu role.

| Role       | Deskripsi                                          |
| ---------- | -------------------------------------------------- |
| `owner`    | Owner — akses penuh ke semua operasi               |
| `admin`    | Admin — akses manajemen                            |
| `courier`  | Courier — akses operasional                        |
| `customer` | Customer — akses fitur end-user dan profil sendiri |

## Endpoints Better Auth

Tersedia di `/api/v1/auth/*`. Dokumentasi lengkap via OpenAPI plugin Better Auth di `/api/docs` (dev only).

## Multi-Tenancy

Plugin Better Auth `organization()` menyediakan konteks organisasi aktif melalui `activeOrganizationId` pada session. Dalam boilerplate multi-org, nilai ini adalah konteks organisasi/organization (`organization_id` di banyak skema). Setiap request tenant-scoped harus memiliki organisasi aktif.

Pada request HTTP, `RlsInterceptor` membaca `session.activeOrganizationId` lalu menjalankan handler dalam `RlsContext` berbasis `AsyncLocalStorage`. Service dan repository tetap wajib menerapkan filter tenant eksplisit; context tidak menggantikan predicate query.

```text
Better Auth session.activeOrganizationId
        ↓
RlsInterceptor
        ↓
RlsContext (AsyncLocalStorage)
        ↓
service/repository menggunakan organization_id
```

### Better Auth Organization Plugin

Konfigurasi multi-tenant menggunakan pola plugin berikut:

```typescript
import { organization } from 'better-auth/plugins';

plugins: [organization()];
```

Gunakan API organisasi untuk memilih organisasi aktif sehingga `activeOrganizationId` tersimpan pada session.

### SSE Authentication Status

`GET /api/realtime/sse/:userId` sudah tersedia dari Foundation Layer P1, tetapi auth guard khusus untuk SSE masih pending P2. Sebelum P2 selesai, dokumentasi dan integrasi klien harus memperlakukan proteksi SSE sebagai tindak lanjut, bukan sebagai jaminan keamanan yang sudah aktif.

## i18n Error Messages

Better Auth dilengkapi dengan plugin i18n yang menerjemahkan kode error otomatis berdasarkan bahasa user.

### Locale Detection

Plugin i18n membaca locale dari (prioritas berurutan):

1. Header `Accept-Language` (contoh: `Accept-Language: id`, `Accept-Language: en`)
2. Cookie `locale` atau `lang`

Default locale: `en` (English).

### Bahasa yang Didukung

- `id` — Bahasa Indonesia
- `en` — English (default)

### Format Response Error

Ketika terjadi error di endpoint Better Auth (`/api/v1/auth/*`), response akan berisi:

```json
{
  "code": "INVALID_EMAIL_OR_PASSWORD",
  "message": "Email atau password salah",
  "originalMessage": "Invalid email or password"
}
```

- `code`: Kode error Better Auth (konstan)
- `message`: Terjemahan sesuai locale user
- `originalMessage`: Pesan asli dalam bahasa Inggris

### Daftar Kode Error yang Diterjemahkan

**Core Authentication**:

- `USER_NOT_FOUND`, `INVALID_EMAIL_OR_PASSWORD`, `INVALID_PASSWORD`, `INVALID_EMAIL`
- `EMAIL_NOT_VERIFIED`, `EMAIL_ALREADY_EXISTS`, `USER_ALREADY_EXISTS`
- `SESSION_EXPIRED`, `FAILED_TO_CREATE_SESSION`
- `INVALID_TOKEN`, `TOKEN_EXPIRED`, `MISSING_TOKEN`
- `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`
- `TOO_MANY_REQUESTS`, `RATE_LIMITED`
- `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`, `UNKNOWN_ERROR`

**Organization (Multi-tenancy)**:

- `ORGANIZATION_NOT_FOUND`, `USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION`, `USER_ALREADY_MEMBER`
- `YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION`, `YOU_ARE_NOT_ALLOWED_TO_INVITE`
- `YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS`
- `INVITATION_EXPIRED`, `INVITATION_NOT_FOUND`, `YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_INVITATIONS`
- `YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_RESOURCE`, `YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION`
- `YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION`, `YOU_ARE_NOT_ALLOWED_TO_LEAVE_THIS_ORGANIZATION`

**Bearer Token**:

- `INVALID_BEARER_TOKEN_FORMAT`, `BEARER_TOKEN_EXPIRED`, `BEARER_TOKEN_REVOKED`

## Role-Based Access Control (RBAC) — Dynamic & Granular

### RBAC Overview berbasis Better Auth `organization` plugin dengan **Dynamic Access Control** aktif. Sistem ini memiliki 2 level role yang hidup berdampingan:

1. **System Role** (`user.role`) — level global, diset saat pembuatan user.
   - `superadmin` / `admin` → akses seluruh sistem tanpa batasan organisasi.
   - `user` → user biasa yang terikat pada organisasi tertentu.
2. **Organization Role** (`organization_role.role`) — level organisasi, dibuat/dikelola oleh owner organisasi secara dinamis via UI.

Pemeriksaan izin dipecah menjadi dua tahap:

- **Allow / Deny** — apakah user _boleh_ melakukan aksi (`product:create`) terhadap resource tertentu.
- **Scope Resolution** — _seberapa jauh_ cakupan akses user (`global` / `organization` / `outlet` / `own`).

Scope yang ter-resolve akan otomatis di-inject ke controller via `@PermissionScope()` untuk dipakai service/repository dalam melakukan filter data (`WHERE` clause).

### Konsep Inti

#### 1. Permission Resource:Action

Setiap permission mengikuti format `resource:action`. Daftar master permission didefinisikan sebagai konstanta di kode (bukan di database) di `src/modules/rbac/constants/permissions.constant.ts` agar ter-type-safe dan menjadi sumber kebenaran tunggal.

| Resource      | Actions                                                             |
| ------------- | ------------------------------------------------------------------- |
| `transaction` | `read`, `create`, `update`, `delete`, `approve`, `cancel`, `export` |
| `product`     | `read`, `create`, `update`, `delete`                                |
| `outlet`      | `read`, `create`, `update`, `delete`                                |
| `member`      | `read`, `invite`, `update`, `remove`, `change_role`                 |
| `report`      | `read`, `export`                                                    |
| `ac`          | `view_audit_trail`, `manage_audit_retention`                        |

Daftar lengkap dan struktur DTO tersedia di:

- Konstanta: `src/modules/rbac/constants/permissions.constant.ts`
- DTO Swagger: `src/modules/rbac/dto/permission.dto.ts`
- Endpoint master: `GET /api/v1/rbac/permissions` (lihat bagian [Master Permissions API](#master-permissions-api))

#### 2. Scope Hierarchy (Prioritas Tertinggi ke Terendah)

Scope mendefinisikan **batasan data** yang boleh diakses user ketika ia _sudah_ lolos allow/deny check.

| Scope          | Deskripsi                                                      | Contoh Filter `WHERE`                  |
| -------------- | -------------------------------------------------------------- | -------------------------------------- |
| `global`       | Akses tanpa batasan organisasi. Hanya `superadmin` / `admin`.  | (tanpa filter organisasi)              |
| `organization` | Akses ke semua record milik organisasi aktif user.             | `WHERE organization_id = :activeOrgId` |
| `outlet`       | Akses ke semua record milik outlet user (perlu module outlet). | `WHERE outlet_id = :userOutletId`      |
| `own`          | Akses hanya ke record yang dibuat/dimiliki user tersebut.      | `WHERE created_by = :userId`           |

**Aturan pewarisan:** jika user memiliki beberapa role (misal `superadmin` + `owner` di org tertentu), scope tertinggi yang _miliknya_ yang dipakai. Contoh: user dengan `superadmin` sistem akan selalu `global`, meskipun juga member `owner`.

#### 3. System vs Organization Roles

| Tipe Role                                                | Diset di       | Bisa dibuat via UI? | Default Scope                 |
| -------------------------------------------------------- | -------------- | ------------------- | ----------------------------- |
| `superadmin`                                             | `user.role`    | Tidak               | `global`                      |
| `admin`                                                  | `user.role`    | Tidak               | `global`                      |
| `user`                                                   | `user.role`    | Tidak               | Turun ke org role             |
| `owner`                                                  | `orgRole.role` | Ya (default)        | `organization`                |
| Custom (mis. `admin_outlet`, `staff_gudang`, `customer`) | `orgRole.role` | Ya                  | Tergantung `permissionScopes` |

Owner sebuah organisasi dapat membuat role-role baru lengkap dengan daftar permission dan scope masing-masing. Ini memungkinkan:

- **Full custom roles** — nama role bebas, permission dipilih butir-butir.
- **Granular scope per permission** — sebuah role bisa memiliki `transaction:read` dengan scope `organization`, tetapi `transaction:create` dengan scope `own`.

### Arsitektur

```text
┌──────────────────────┐
│ HTTP Request         │
│ (cookie / Bearer)    │
└─────────┬────────────┘
          ↓
┌──────────────────────────────────────────┐
│ @RequirePermission('product:read')       │
│  ├─ @MemberHasPermission (BA Guard)      │ ← Allow / Deny
│  └─ PermissionScopeInterceptor           │ ← Scope resolution
│      └─ request.permissionScope attached │
└─────────┬────────────────────────────────┘
          ↓
┌──────────────────────────────────────────┐
│ @PermissionScope() → injected ke handler │
│ Handler memanggil service(repository, ...query, scope)│
└─────────┬────────────────────────────────┘
          ↓
┌──────────────────────────────────────────┐
│ Service/Repository menerapkan WHERE      │
│ clause berdasarkan scope.type            │
└──────────────────────────────────────────┘
```

#### Komponen Kunci

| Komponen                                     | Lokasi                                                          | Fungsi                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `MASTER_PERMISSIONS` (constant)              | `src/modules/rbac/constants/permissions.constant.ts`            | Definisi master resource & actions — sumber kebenaran tunggal untuk format `resource:action`.    |
| `getBetterAuthStatement()`                   | sama                                                            | Mengkonversi `MASTER_PERMISSIONS` menjadi statement yang dipahami `createAccessControl()`.       |
| `RequirePermission(perm)` decorator          | `src/modules/rbac/decorators/require-permission.decorator.ts`   | Menggabungkan `@MemberHasPermission` + metadata `ScopeMeta` + `PermissionScopeInterceptor`.      |
| `PermissionScope()` param decorator          | `src/modules/rbac/decorators/permission-scope.decorator.ts`     | Mengambil `request.permissionScope` dan inject ke method parameter.                              |
| `PermissionScopeInterceptor`                 | `src/modules/rbac/interceptors/permission-scope.interceptor.ts` | Memanggil `PermissionScopeService` dan menempelkan scope ke request.                             |
| `PermissionScopeService`                     | `src/modules/rbac/services/permission-scope.service.ts`         | Resolusi scope efektif user (system / org / outlet / own) berdasarkan role + `permissionScopes`. |
| `AuditTrailService` + `AuditTrailRepository` | `src/modules/rbac/services/audit-trail.service.ts`              | Mencatat setiap perubahan RBAC (role, permission, assignment) ke tabel `audit_trail_logs`.       |
| `PermissionsController`                      | `src/modules/rbac/controllers/permissions.controller.ts`        | API master data untuk UI superadmin.                                                             |

### Master Permissions API

Endpoint publik (tanpa otentikasi) untuk kebutuhan UI frontend saat membangun halaman manajemen role/permission. Data yang dikembalikan adalah **master permission list** (read-only), bukan data spesifik user.

| Method | Path                             | Deskripsi                                                          |
| ------ | -------------------------------- | ------------------------------------------------------------------ |
| `GET`  | `/api/v1/rbac/permissions`       | Master permissions lengkap per resource + actions.                 |
| `GET`  | `/api/v1/rbac/permissions/codes` | Daftar flat kode permission (`string[]`) format `resource:action`. |

Contoh response `GET /api/v1/rbac/permissions`:

```json
{
  "resources": [
    {
      "resource": "transaction",
      "actions": [
        "read",
        "create",
        "update",
        "delete",
        "approve",
        "cancel",
        "export"
      ],
      "count": 7
    },
    {
      "resource": "product",
      "actions": ["read", "create", "update", "delete"],
      "count": 4
    }
  ],
  "totalResources": 6,
  "totalPermissions": 32
}
```

Contoh response `GET /api/v1/rbac/permissions/codes`:

```json
[
  "transaction:read",
  "transaction:create",
  "transaction:update",
  "transaction:delete",
  "transaction:approve",
  "transaction:cancel",
  "transaction:export",
  "product:read",
  "..."
]
```

### Cara Pakai di Controller

#### Pola Standar

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission, PermissionScope } from '@/modules/rbac/decorators';
import { PermissionScopeContext } from '@/modules/rbac/types';

@Controller('products')
export class ProductController {
  @Get()
  @RequirePermission('product:read')
  async findAll(
    @Query() query: FindProductsDto,
    @PermissionScope() scope: PermissionScopeContext,
  ) {
    // scope.type ∈ 'global' | 'organization' | 'outlet' | 'own'
    return this.productService.findAll(query, scope);
  }

  @Post()
  @RequirePermission('product:create')
  async create(@Body() dto: CreateProductDto) {
    // Create tidak butuh scope karena operasi tulis
    return this.productService.create(dto);
  }
}
```

#### Multi-Permission (semua harus lulus)

```typescript
@Get('audit')
@RequirePermissions(['ac:view_audit_trail', 'transaction:read'])
async getAudit(@PermissionScope() scope: PermissionScopeContext) {
  // ...
}
```

#### Validasi Format

`@RequirePermission()` melempar error saat module di-load jika format string tidak sesuai:

```text
Invalid permission format: "invalid_format". Expected "resource:action"
```

Format yang valid: `^[a-z_]+:[a-z_]+$` (huruf kecil + underscore).

### Filter Data Berdasarkan Scope (Service / Repository Layer)

`PermissionScopeContext` yang di-inject WAJIB dipakai oleh service/repository untuk menambahkan filter `WHERE`. Contoh pola di repository:

```typescript
// src/modules/product/product.repository.ts
async findAll(query: FindProductsDto, scope: PermissionScopeContext) {
  const conditions = [];

  switch (scope.type) {
    case 'global':
      // Tidak ada filter organisasi — user superadmin
      break;
    case 'organization':
      conditions.push(eq(products.organizationId, scope.orgId));
      break;
    case 'outlet':
      conditions.push(eq(products.outletId, scope.outletId));
      break;
    case 'own':
      conditions.push(eq(products.createdBy, scope.userId));
      break;
  }

  // ... gabungkan dengan query.search, query.page, dll
}
```

**Penting:** Tanpa penerapan filter ini, scope menjadi meaningless — user `own` akan melihat semua data organisasi. Filter ini adalah tanggung jawab service/repository layer.

### Pembuatan Role Dinamis (via UI)

1. Owner organisasi mengirim request ke Better Auth `organization` plugin endpoint (atau endpoint RBAC tambahan kita) untuk membuat role baru.
2. Frontend memanggil `GET /api/v1/rbac/permissions` untuk mengambil master permission list (resource + actions).
3. Frontend mengirim daftar permission + scope per permission ke endpoint pembuatan role.
4. Backend menyimpan ke tabel `organization_role` dengan field tambahan:

```typescript
{
  id: 'role_xxx',
  organizationId: 'org_yyy',
  role: 'admin_outlet',           // nama role (custom)
  permission: {                    // resource → actions (BA format)
    transaction: ['read', 'create'],
    product: ['read']
  },
  permissionScopes: {              // ← ekstensi kita — scope per permission
    'transaction:read': 'outlet',
    'transaction:create': 'outlet',
    'product:read': 'outlet'
  }
}
```

### Audit Trail

Setiap perubahan pada entitas RBAC (create role, update permission, delete role, change member role) tercatat di tabel `audit_trail_logs` dengan `moduleKey = 'rbac'`.

```typescript
await this.auditTrailService.logRbacChange({
  actorId: currentUser.id,
  action: 'role.update',
  entityType: 'organizationRole',
  entityId: role.id,
  oldValue: previousRoleData,
  newValue: updatedRoleData,
  metadata: { reason: dto.reason },
});
```

Pemeriksaan via `AuditTrailService`:

| Method                                     | Kegunaan                                                  |
| ------------------------------------------ | --------------------------------------------------------- |
| `log(params)`                              | Generic log event.                                        |
| `logRbacChange(params)`                    | Shorthand untuk event RBAC (`moduleKey='rbac'` otomatis). |
| `findByModule('rbac', { limit, offset })`  | List log RBAC (untuk halaman audit).                      |
| `findByEntity('organizationRole', roleId)` | Histori perubahan satu role spesifik.                     |

### Caching & Performance

Pemeriksaan permission TIDAK melakukan query DB setiap request, melainkan:

1. **Session-Level Cache** — Better Auth menyimpan effective permissions di session token (cookie atau signed bearer). Validasi allow/deny terjadi dari session.
2. **Better Auth API** — Hanya dipanggil saat `PermissionScopeService` perlu me-resolve scope (`getFullOrganization`, `getOrgRole`). Pada user `superadmin`/`admin`, panggilan ini di-bypass sama sekali.
3. **Hybrid Sync** — Perubahan role/permission di-trigger invalidasi cache session user terkait. Implementasi ada di `PermissionScopeService.createUserScope()` dan helper background job.

#### Prinsip Performa

- Selalu cache `permissionScopes` per `(userId, organizationId, permission)`.
- Invalidasi cache saat:
  - Role organisasi diubah.
  - Member di-remove atau role-nya diganti.
  - User membuat/menghapus organisasi.
- Background job (jika ada) gunakan `PermissionScopeService.createSystemScope()` untuk konteks SYSTEM.

### Background Jobs

Ada 2 mode untuk permission context di background job:

1. **System-initiated** (cron, webhook processor) — gunakan scope SYSTEM:

   ```typescript
   const scope = this.permissionScopeService.createSystemScope();
   // scope = { type: 'global', userId: 'SYSTEM' }
   ```

2. **User-initiated** (job yang di-trigger dari request user) — teruskan scope dari inisiator:

   ```typescript
   const userScope = await this.permissionScopeService.createUserScope(
     initiator.id,
     initiator.activeOrgId,
     'transaction',
     'approve',
   );
   await this.transactionQueue.add(
     'process',
     { transactionId },
     { scope: userScope },
   );
   ```

### Edge Cases & Aturan Penting

- **Tanpa `activeOrganizationId`** → otomatis fallback ke scope `own` (user hanya boleh akses resource miliknya sendiri di luar konteks organisasi).
- **Multi-role user** (system `admin` + org `staff`) → scope tertinggi yang menang (`global` > `organization` > `outlet` > `own`).
- **Permission tidak ada di `permissionScopes`** → fallback ke `own` (prinsip least privilege).
- **Bearer token** → tetap bekerja karena Better Auth `bearer()` plugin me-resolve session yang sama; `@RequirePermission` & `@PermissionScope` tidak perlu perubahan.
- **Anonymous endpoint** → gunakan `@AllowAnonymous()` dari `@thallesp/nestjs-better-auth` jika memang publik; endpoint `/api/v1/rbac/permissions` saat ini anonymous (master data publik).

### File Terjemahan

Terjemahan disimpan di:

- `src/i18n/id/auth-errors.json` — Bahasa Indonesia
- `src/i18n/en/auth-errors.json` — English

## Error Logging

Semua error dari Better Auth (level `error`) otomatis ditulis ke winston logger yang sama dengan error Nest lainnya.

### Alur Logging

```text
Better Auth handler error
   ↓
internal BA logger (level=error)
   ↓
logger.log(level, msg, ...args)  ← dari getBetterAuthLogHandler()
   ↓
AppLoggerService.error(msg, stack, 'BetterAuth')
   ↓
winston (Console + error-*.log)
```

### Lokasi Log File

- **Console**: Log error tampil di console dengan prefix `[BetterAuth]`
- **File**: `logs/error-YYYY-MM-DD.log` (rotasi harian, retensi 30 hari)

### Context

Semua log error Better Auth memiliki context `BetterAuth`, sehingga mudah difilter:

```bash
# Grep error BA saja
grep 'BetterAuth' logs/error-2026-07-04.log

# Contoh output
2026-07-04 20:15:32 [BetterAuth] error: INVALID_EMAIL_OR_PASSWORD - Sign in failed for user@example.com
```

### Implementation

Bridge logger Better Auth → AppLoggerService diimplementasikan di `src/auth/better-auth.logger.ts` dengan pattern late-init (di-set dari `main.ts` setelah DI Nest siap).

Konfigurasi Better Auth logger:

```typescript
// src/auth/auth.ts
logger: {
  disabled: false,
  level: 'error',  // hanya error yang di-log
  log: getBetterAuthLogHandler(),
}
```
