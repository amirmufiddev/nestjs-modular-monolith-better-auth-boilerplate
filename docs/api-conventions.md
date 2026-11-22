# API Conventions

Standar desain dan konvensi HTTP API untuk backend ini.

## Foundation Layer Status (P1)

Foundation Layer P1 sudah selesai. Konvensi REST yang ada tetap menjadi dasar API; implementasi realtime menambahkan endpoint SSE dan envelope event yang dipakai konsisten untuk pembaruan realtime. Contoh implementasi aktual tersedia di [`src/shared/README.md`](../src/shared/README.md).

## Daftar Isi

- [Base URL](#base-url)
- [REST Naming Convention](#rest-naming-convention)
- [SSE Realtime Endpoint](#sse-realtime-endpoint)
- [Event Envelope Realtime](#event-envelope-realtime)
- [HTTP Methods](#http-methods)
- [HTTP Status Codes](#http-status-codes)
- [Error Envelope](#error-envelope)
- [Success Response Envelope](#success-response-envelope)
- [Paginasi](#paginasi)
- [Response DTO vs Entity](#response-dto-vs-entity)
- [API Versioning](#api-versioning)
- [Autentikasi](#autentikasi)
- [Validasi Input](#validasi-input)
- [OpenAPI / Swagger](#openapi--swagger)
- [i18n](#i18n)
- [Checklist API Design](#checklist-api-design)

---

## Base URL

```text
/api/v1/...   — endpoint owner/admin (bisnis manajemen)
/api/...      — endpoint publik dan customer
/api/v1/auth/... — endpoint Better Auth (login, register, session)
```

---

## REST Naming Convention

| Element      | Aturan                          | Contoh                         |
| ------------ | ------------------------------- | ------------------------------ |
| Path prefix  | `kebab-case`, **selalu plural** | `/api/orders`, `/api/products` |
| Sub-resource | Singular noun setelah plural    | `/api/orders/:id/items`        |
| Action verb  | Hanya untuk non-CRUD            | `/api/orders/:id/cancel`       |
| Query param  | `camelCase`                     | `?orderNumber=ABC&limit=10`    |

### Larang

- Campur singular & plural (`/api/user` vs `/api/orders`)
- Pakai kata kerja di path (`/api/getUsers`, `/api/createOrder`)
- Pakai method yang salah (`GET` untuk delete, `POST` untuk update)

### REST Naming - Contoh Salah & Benar

```typescript
// ❌ Bad — Inconsistent
@Controller('user')
@Controller('order')
@Controller('payments')         // Plural — inkonsisten
@Controller('api/products')    // Prefix `api/` tidak perlu (sudah global)

// ✅ Good — Konsisten plural nouns
@Controller('users')
@Controller('orders')
@Controller('products')
```

---

## SSE Realtime Endpoint

Endpoint realtime memakai Server-Sent Events untuk streaming pembaruan ke dashboard admin:

```text
GET /api/realtime/sse/:userId
Content-Type: text/event-stream
```

`SseController` mengembalikan stream `text/event-stream` yang dikelola oleh `SseService`. Channel internal mengikuti konteks subscriber, misalnya `admin:userId` atau `admin:userId:organizationId`. Auth guard untuk endpoint SSE masih menjadi tindak lanjut P2; jangan menganggap endpoint saat ini sudah memiliki proteksi tersebut.

## Event Envelope Realtime

Payload event realtime memakai bentuk envelope yang konsisten dengan kontrak event lintas REST dan SSE:

```json
{
  "type": "order.status_changed",
  "data": {
    "orderId": "o-123",
    "newStatus": "confirmed"
  },
  "timestamp": 1720000000000
}
```

Gunakan `type` untuk nama event, `data` untuk payload terkontrak, dan `timestamp` untuk waktu publikasi. Jangan mengirim entity mentah atau field internal melalui SSE.

---

## HTTP Methods

| Method   | Kegunaan             | Response Code |
| -------- | -------------------- | ------------- |
| `GET`    | Read resource / list | 200           |
| `POST`   | Create resource      | 201           |
| `PUT`    | Full update          | 200           |
| `PATCH`  | Partial update       | 200           |
| `DELETE` | Remove resource      | 200 / 204     |

### Wajib Pakai Method yang Benar

```typescript
// ❌ Bad — Salah method
@Post('update/:id')    // POST untuk update SALAH!
@Get('delete/:id')     // GET untuk delete SALAH (cached, logged, dangerous)

// ✅ Good — RESTful
@Post()                // Create
@Put(':id')            // Full update
@Patch(':id')          // Partial update
@Delete(':id')         // Delete
@Get(':id')            // Read
@Get()                 // List
```

### `@HttpCode` Wajib untuk Create

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)  // 201, bukan default 200
async create(@Body() dto: CreateOrderDto) { ... }
```

---

## HTTP Status Codes

| Status | Kapan                                              |
| ------ | -------------------------------------------------- |
| 200    | GET / PATCH / PUT sukses                           |
| 201    | POST sukses (create)                               |
| 204    | DELETE sukses tanpa body                           |
| 400    | Validasi gagal / bad request                       |
| 401    | Tidak terautentikasi                               |
| 403    | Tidak memiliki role yang diperlukan                |
| 404    | Resource tidak ditemukan                           |
| 409    | Conflict (duplicate, FK constraint, state invalid) |
| 422    | Business rule violation (misal: saldo tidak cukup) |
| 500    | Internal server error                              |

---

## Error Envelope

Semua error dikembalikan oleh `HttpExceptionFilter` dengan format:

```json
{
  "statusCode": 404,
  "timestamp": "2026-07-04T10:00:00.000Z",
  "path": "/api/orders/not-found-id",
  "message": "Order tidak ditemukan",
  "error": "NotFoundException",
  "code": "ORDER_NOT_FOUND",
  "context": {
    "resource": "Order",
    "id": "not-found-id"
  }
}
```

| Field        | Keterangan                                                 |
| ------------ | ---------------------------------------------------------- |
| `statusCode` | HTTP status (selalu diisi)                                 |
| `timestamp`  | ISO 8601 waktu error                                       |
| `path`       | URL path yang diakses                                      |
| `message`    | Pesan human-readable (bisa i18n)                           |
| `error`      | Nama exception class                                       |
| `code`       | Kode mesin-friendly untuk programmatic handling (opsional) |
| `details`    | Detail tambahan (resource ID, field, dll.) (opsional)      |

Semua error dikembalikan oleh `HttpExceptionFilter` dengan format standar `{ statusCode, error, code, message, details? }`. Implementasi boleh menambahkan metadata transport seperti `timestamp` dan `path`, tetapi empat field inti tersebut harus tetap tersedia.

Lihat [error-handling.md](./error-handling.md) untuk detail `BusinessError`.

---

## Success Response Envelope

Untuk konsistensi, success response juga dibungkus:

```json
{
  "success": true,
  "data": {/* payload */},
  "meta": {
    "timestamp": "2026-07-04T10:00:00.000Z",
    "requestId": "uuid-correlation-id"
  }
}
```

Untuk list dengan pagination:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8,
    "requestId": "uuid-correlation-id"
  }
}
```

### Implementasi dengan Interceptor

```typescript
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request['correlationId'],
        },
      })),
    );
  }
}
```

Daftarkan global di `main.ts`:

```typescript
app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
```

> Catatan: Error responses **tidak** masuk interceptor — tetap diformat oleh `HttpExceptionFilter`.

---

## Paginasi

Parameter query standar:

| Parameter | Default | Keterangan              |
| --------- | ------- | ----------------------- |
| `limit`   | 20      | Jumlah item per halaman |
| `offset`  | 0       | Offset untuk paginasi   |

Contoh:

```text
GET /api/orders?limit=10&offset=20
```

### PaginationDto Wajib

```typescript
// src/common/dto/pagination.dto.ts
export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset: number = 0;
}
```

### Response Pagination

```typescript
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

### Terapkan di Service

```typescript
// ❌ Bad — parsing manual tersebar
async findAll(limit?: string, offset?: string) {
  const pagination = {
    limit: parseInt(limit ?? '20'),
    offset: parseInt(offset ?? '0'),
  };
  // ...
}

// ✅ Good — pakai PaginationDto
async findAll(@Query() pagination: PaginationDto) {
  return this.repo.findPaginated({
    limit: pagination.limit,
    offset: pagination.offset,
  });
}
```

---

## Response DTO vs Entity

**JANGAN** kembalikan entity mentah dari controller. Entity bisa berisi field internal (password, internalNotes, dsb.) yang tidak boleh暴露 ke client.

### Response DTO - Contoh Salah & Benar

```typescript
// ❌ Bad — Return raw entity (leak password, internal fields)
@Get(':id')
async findOne(@Param('id') id: string): Promise<User> {
  return this.userService.findById(id);
  // User entity has: password, internalNotes, dll.
}
```

```typescript
// ✅ Good — Return DTO dengan explicit fields
@Get(':id')
async findOne(@Param('id') id: string): Promise<UserResponseDto> {
  const user = await this.userService.findById(id);
  return UserResponseDto.fromEntity(user);
}
```

### Pattern DTO

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @Exclude() // Hide from response
  password: string;

  @Exclude()
  internalNotes: string;

  static fromEntity(user: User): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
```

---

## API Versioning

Gunakan **path versioning** untuk breaking changes:

```typescript
// ❌ Bad — No versioning, breaking changes affect semua client
@Controller('users')
export class UsersController {}
```

```typescript
// ✅ Good — Versioned
@Controller({ path: 'users', version: '1' })
export class UsersV1Controller {}

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {} // Dengan breaking changes
```

Atau URL versioning:

```typescript
@Controller('v1/users')
@Controller('v2/users')
```

### Kapan Bikin Versi Baru

- Menghapus field dari response
- Mengubah tipe field
- Mengubah semantic endpoint
- Mengubah auth requirement

> **Tidak perlu versi baru** untuk: tambah field baru (caller lama abaikan), tambah endpoint baru.

---

## Autentikasi

Semua endpoint (kecuali `/api/v1/auth/*` dan `/health`) membutuhkan autentikasi.

```text
Header: Authorization: Bearer <token>
```

Atau via cookie session (default untuk web).

Lihat [auth.md](./auth.md) untuk detail role matrix dan alur Better Auth.

---

## Validasi Input

Input divalidasi di controller menggunakan class-validator DTO. Field yang tidak dikenal ditolak (`forbidNonWhitelisted: true`).

### Wajib Pakai DTO

```typescript
// ❌ Bad — Pakai @Body() raw tanpa DTO
@Post()
async create(@Body() body: any) {
  // Tidak ada validasi!
}

// ✅ Good — Pakai DTO dengan class-validator
@Post()
async create(@Body() dto: CreateOrderDto) { ... }
```

```typescript
// src/modules/order/dto/create-order.dto.ts
export class CreateOrderDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

Lihat [security-guidelines.md](./security-guidelines.md) untuk detail.

---

## OpenAPI / Swagger

Semua endpoint WAJIB punya dekorator Swagger untuk dokumentasi otomatis.

### Contoh Lengkap

```typescript
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
    type: ValidationErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
    type: NotFoundErrorDto,
  })
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.orderService.create(dto);
  }
}
```

### OpenAPI / Scalar di codebase

- Dipasang hanya jika `app.nodeEnv === 'development'` di `src/main.ts` (memanggil `src/bootstrap/openapi.config.ts`).
- UI: `http://localhost:2001/docs` (Scalar + `@scalar/nestjs-api-reference`)
- JSON: `http://localhost:2001/docs-json`
- Produksi: route docs **tidak** diregister — jangan mengandalkan UI docs di prod; generate JSON dari staging/CI bila perlu.
- Helmet CSP untuk Scalar (cdn.jsdelivr.net): `src/bootstrap/helmet.config.ts` — `scriptSrc`, `styleSrc`, `connectSrc` untuk `connectSrc: 'self'` ke `/docs-json`.

Checklist deploy: pastikan `/docs` dan `/docs-json` tidak dapat diakses di production (guard sudah di `main.ts`).

---

## i18n

Header `Accept-Language: id` (default) atau `en` untuk respons dalam bahasa yang berbeda.

```typescript
// Service
throw BusinessError.notFound('Order', orderId);
// → message otomatis diterjemahkan via nestjs-i18n berdasarkan header Accept-Language
```

---

## API Design Red Flags

| Pattern                        | Severity    | Example                                 |
| ------------------------------ | ----------- | --------------------------------------- |
| Endpoint list tanpa pagination | 🟡 Warning  | `GET /users` returns all (jutaan)       |
| Missing response DTO           | 🟡 Warning  | Return raw entity (leak field)          |
| Plural/singular inconsistency  | 🟡 Warning  | `GET /user` vs `GET /orders`            |
| Wrong HTTP method              | 🔴 Critical | `POST` untuk update, `GET` untuk delete |
| Missing status code variation  | 🟡 Warning  | Semua return 200 dengan status field    |
| No API versioning              | 🟡 Warning  | Breaking changes tanpa `/v2/` prefix    |
| Inconsistent response shape    | 🟡 Warning  | `{ data, items, results }` campur       |
| Missing OpenAPI/Swagger docs   | 🟡 Warning  | Tidak ada `@ApiResponse`                |

---

## Checklist API Design

Setiap endpoint baru harus lulus checklist ini:

### Naming & Method

- [ ] Path pakai **plural** konsisten
- [ ] HTTP method sesuai operasi (GET/POST/PUT/PATCH/DELETE)
- [ ] `@HttpCode(201)` di setiap POST create

### Response

- [ ] Pakai Response DTO, **TIDAK** return entity mentah
- [ ] Success response ter-envelope (`success`, `data`, `meta`)
- [ ] Error response melalui `HttpExceptionFilter` (lihat [error-handling.md](./error-handling.md))

### Pagination

- [ ] List endpoint punya pagination (`PaginationDto`)
- [ ] Response list include `meta.page`, `meta.limit`, `meta.total`

### Validation

- [ ] Input pakai DTO dengan class-validator
- [ ] `@IsUUID()` untuk ID params
- [ ] `@IsEnum()` untuk field enum
- [ ] `forbidNonWhitelisted: true` aktif

### Auth

- [ ] Pakai `@OrgRoles()` atau `@MemberHasPermission()` dari `@thallesp/nestjs-better-auth` untuk otorisasi
- [ ] Endpoint publik ditandai `@AllowAnonymous()`

### Documentation

- [ ] `@ApiTags`, `@ApiOperation`, `@ApiResponse` lengkap
- [ ] Response DTO punya `@ApiProperty` di setiap field

---

## Referensi

- [error-handling.md](./error-handling.md) — Detail BusinessError & filter
- [security-guidelines.md](./security-guidelines.md) — Auth, validation, secret
- [testing.md](./testing.md) — Test untuk setiap endpoint
