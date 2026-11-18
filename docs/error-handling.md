# Error Handling — Pola & Best Practice

Dokumen ini membahas standar error handling di backend ini, termasuk typed errors, global filter, async error propagation, dan boundary antara layer.

## Status Foundation Layer

**P1 selesai.** `BusinessError` menyediakan factory HTTP umum (termasuk `moduleApiUnavailable` untuk boundary antar modul), sementara `AllExceptionsFilter` terdaftar sebagai `APP_FILTER` di `AppModule`. Foundation realtime dan push juga memiliki kontrak kegagalan yang eksplisit: SSE mencatat event yang tidak memiliki subscriber, dan `FcmAdapter` mengembalikan `false` dalam no-op atau ketika pengiriman gagal. Detail struktur shared ada di [`src/shared/README.md`](../src/shared/README.md).

## Daftar Isi

- [Error Red Flags](#error-red-flags)
- [Lapisan Error Handling](#lapisan-error-handling)
- [Custom Error Classes](#custom-error-classes)
- [BusinessError Factories P1](#businesserror-factories-p1)
- [Global Exception Filter](#global-exception-filter)
- [Async Error Propagation](#async-error-propagation)
- [Prinsip Error Boundary](#prinsip-error-boundary)
- [Checklist Error Handling](#checklist-error-handling)

---

## Error Red Flags

| Pattern                     | Severity    | Impact                            |
| --------------------------- | ----------- | --------------------------------- |
| Empty catch block           | 🔴 Critical | Exception hilang, debugging susah |
| Catch hanya `console.log`   | 🟡 Warning  | Tidak propagate ke user           |
| Generic `throw new Error()` | 🟡 Warning  | Tidak ada context/code            |
| Async tanpa try/catch       | 🟡 Warning  | Unhandled rejection               |
| Return `null` saat error    | 🟡 Warning  | Caller tidak tahu error           |
| Inconsistent error format   | 🟡 Warning  | Frontend susah handle             |

---

## Lapisan Error Handling

```text
┌──────────────────────────────────────┐
│ Global Filter (AllExceptionsFilter)  │  ← Format konsisten, log, kirim ke client
├──────────────────────────────────────┤
│ BusinessError.throw() di service     │  ← Throw typed error dengan code + context
├──────────────────────────────────────┤
│ Repository throw specific            │  ← Misal: throw DB constraint violation
└──────────────────────────────────────┘
```

### Tanggung Jawab Per Layer

| Layer      | Tanggung Jawab                                                       |
| ---------- | -------------------------------------------------------------------- |
| Repository | Lempar error spesifik DB (unique violation, FK constraint, dll.)     |
| Service    | Tangkap error dari repo, transform ke `BusinessError` dengan context |
| Controller | Tidak ada try/catch untuk business logic — biarkan global filter     |
| Filter     | Serialize error → HTTP response + log dengan correlation ID          |

---

## Custom Error Classes

### BusinessError

`BusinessError` adalah base class untuk error bisnis yang membawa kode, context, dan HTTP status. Gunakan factory yang tersedia di `src/common/errors/business-error.ts`; signature factory aktual menerima `code` opsional pada helper generik.

```typescript
// src/common/errors/business-error.ts
export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessError';
  }

  static notFound(resource: string, id: string) {
    return new BusinessError(
      `${resource} ${id} tidak ditemukan`,
      `${resource.toUpperCase()}_NOT_FOUND`,
      HttpStatus.NOT_FOUND,
      { resource, id },
    );
  }

  static badRequest(
    message: string,
    code = 'BAD_REQUEST',
    context?: Record<string, unknown>,
  ) {
    return new BusinessError(message, code, HttpStatus.BAD_REQUEST, context);
  }
}
```

### BusinessError Factories P1

Gunakan factory berikut untuk kasus yang sudah menjadi kontrak foundation. Factory mengembalikan `BusinessError` dengan status HTTP, kode programatik, dan context terstruktur.

```typescript
const validationError = BusinessError.unprocessable(
  'Validasi gagal',
  'VALIDATION_FAILED',
  { fields: ['email'] },
);
// 422, VALIDATION_FAILED, { fields: [...] }

const moduleError = BusinessError.moduleApiUnavailable('MemberApi', 'invite');
// 503, MODULE_API_UNAVAILABLE, { module: 'MemberApi', method: 'invite' }
```

Gunakan factory umum di atas; tambahkan factory baru hanya bila pola error itu diulang di banyak modul. Modul bisnis boleh memakai `BusinessError.badRequest/conflict/...` dengan `code` khusus tanpa menambah factory global.

### Generic Error — Dihindari

```typescript
// ❌ Bad — Generic error tanpa context
if (!user) throw new Error('Not found');

async function getUser(id: string) {
  const user = await userRepo.findById(id);
  if (!user) throw new Error('User not found'); // Caller tidak tahu ID mana
  return user;
}
```

```typescript
// ✅ Good — Typed error dengan code & context
async function getUser(id: string) {
  const user = await userRepo.findById(id);
  if (!user) throw BusinessError.notFound('User', id);
  return user;
}
```

### DomainError di Dalam Modul

```typescript
// src/modules/member/domain/member.domain-error.ts
export class MemberDomainError extends DomainError {
  constructor(message: string, code = 'MEMBER_DOMAIN_ERROR') {
    super(message, code);
    this.name = 'MemberDomainError';
  }
}
```

---

## Global Exception Filter

`HttpExceptionFilter` (atau `AllExceptionsFilter`) memformat SEMUA error menjadi response JSON yang konsisten.

### Bentuk Response Standar

```json
{
  "statusCode": 404,
  "timestamp": "2026-07-04T10:00:00.000Z",
  "path": "/v1/members/not-found-id",
  "message": "Member not-found-id tidak ditemukan",
  "error": "BusinessError",
  "code": "MEMBER_NOT_FOUND",
  "context": {
    "resource": "Member",
    "id": "not-found-id"
  }
}
```

### Implementasi Sederhana

```typescript
// src/common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorName = 'InternalServerError';
    let code: string | undefined;
    let context: Record<string, unknown> | undefined;

    if (exception instanceof BusinessError) {
      statusCode = exception.httpStatus;
      message = exception.message;
      errorName = exception.name;
      code = exception.code;
      context = exception.context;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        message = (res as any).message ?? message;
      }
      errorName = exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name;
    }

    // Log dengan correlation ID
    const correlationId = request['correlationId'];

    if (statusCode >= 500) {
      this.logger.error({
        message: `[${correlationId}] ${errorName}: ${message}`,
        stack: exception instanceof Error ? exception.stack : undefined,
        path: request.url,
      });
    } else {
      this.logger.warn({
        message: `[${correlationId}] ${errorName}: ${message}`,
        path: request.url,
      });
    }

    response.status(statusCode).json({
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error: errorName,
      code,
      context,
    });
  }
}
```

### Registrasi Global

`AllExceptionsFilter` didaftarkan sebagai provider `APP_FILTER` di `src/app.module.ts`, sehingga controller tidak perlu membuat instance filter atau memasang filter per route. Filter membaca `BusinessError`, `HttpException`, dan `Error`, lalu mengirim envelope yang berisi `statusCode`, `timestamp`, `path`, `message`, `error`, `code`, `context`, dan `correlationId`.

```typescript
// src/app.module.ts
{
  provide: APP_FILTER,
  useClass: AllExceptionsFilter,
}
```

`ErrorResponseDto` di `src/common/dto/error-response.dto.ts` adalah kontrak dokumentasi response. Detail implementasi filter dapat berubah, tetapi field envelope tersebut harus dipertahankan untuk client.

---

## Async Error Propagation

### Fire-and-Forget — Bahaya

```typescript
// ❌ Bad — Errors hilang
async processItems(items: Item[]) {
  items.forEach(async (item) => {
    await this.process(item); // Errors lost!
  });
}
```

### Promise.all — Parallel dengan Fail-Fast

```typescript
// ✅ Good — Parallel, tapi gagal satu = gagal semua
async processItems(items: Item[]) {
  await Promise.all(items.map((item) => this.process(item)));
}
```

### Promise.allSettled — Tahan Error Sebagian

```typescript
// ✅ Good — Sebagian gagal tidak menggugurkan semua
async processItems(items: Item[]) {
  const results = await Promise.allSettled(
    items.map((item) => this.process(item))
  );

  const failures = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason);

  if (failures.length > 0) {
    this.logger.error('Some items failed', { failures });
  }

  return results
    .filter((r): r is PromiseFulfilledResult<Item> => r.status === 'fulfilled')
    .map((r) => r.value);
}
```

### Async Function Caller — Wajib `await` atau `.catch()`

```typescript
// ❌ Bad — Caller lupa await
async controllerMethod() {
  this.emailService.send(invitePayload); // Unhandled promise rejection
  return invite;
}

// ✅ Good — kegagalan ditangani dan dicatat
async controllerMethod() {
  const sent = await this.fcmAdapter.sendToToken(token, payload);
  if (!sent) {
    this.logger.warn('Push notification tidak terkirim', { userId });
  }
  return member;
}
```

Adapter FCM memang mengembalikan `false` untuk no-op atau kegagalan provider; caller harus memilih apakah kondisi tersebut hanya dicatat, dijadwalkan ulang, atau diubah menjadi error bisnis. Jangan menganggap `false` sebagai exception yang otomatis ditangkap filter.

---

## Prinsip Error Boundary

### 1. Repository Lempar Error Mentah

```typescript
// Repository — lempar error Drizzle/Postgres mentah
async insert(data: NewMember) {
  try {
    return await this.db.insert(membersTable).values(data).returning();
  } catch (e) {
    // Misal: unique constraint violation
    if (e.code === '23505') {
      throw e; // Lempar mentah, service yang transform
    }
    throw e;
  }
}
```

### 2. Service Tangkap & Transform

```typescript
// Service — transform ke BusinessError
async inviteMember(dto: InviteMemberDto) {
  try {
    return await this.memberRepo.insert(dto);
  } catch (e) {
    if (e.code === '23505' && e.constraint === 'uq_member_email_org') {
      throw BusinessError.conflict('Email sudah terdaftar di organisasi ini', {
        email: dto.email,
      });
    }
    throw e; // Re-throw unknown
  }
}
```

### 3. Controller Tidak Tangkap

```typescript
// Controller — biarkan error mengalir ke global filter
@Post()
async invite(@Body() dto: InviteMemberDto) {
  return await this.memberService.inviteMember(dto);
}
```

---

## Pola Catch Block yang Benar

### Empty Catch — Dihindari

```typescript
// ❌ Bad — Empty catch
try {
  await riskyOperation();
} catch (e) {}
```

```typescript
// ❌ Bad — Only log, no propagate
try {
  await riskyOperation();
} catch (e) {
  console.log(e);
}
```

### Log + Rethrow dengan Context

```typescript
// ✅ Good — Log + rethrow with context
try {
  await riskyOperation();
} catch (e) {
  this.logger.error('Operation failed', {
    error: e,
    context: { userId, operation: 'risky' },
  });
  throw new OperationFailedError(e, { userId });
}
```

### Specific Handling

```typescript
// ✅ Good — Specific handling
try {
  return await this.parseJson(data);
} catch (e) {
  if (e instanceof SyntaxError) {
    throw new InvalidJsonError(data, e);
  }
  throw e; // Re-throw unexpected
}
```

---

## Checklist Error Handling

Setiap service/controller/repo yang ditulis harus lulus checklist ini:

### Error Definition

- [ ] Pakai `BusinessError.notFound/conflict/badRequest/forbidden` untuk error bisnis generik
- [ ] Pakai `BusinessError.moduleApiUnavailable` untuk kegagalan boundary antar modul; sisanya factory HTTP umum
- [ ] Tidak ada `throw new Error('...')` di service layer untuk error bisnis
- [ ] Error subclass spesifik untuk domain khusus (opsional)

### Catch Block

- [ ] Tidak ada empty catch block
- [ ] Catch block melakukan log + rethrow (atau transform ke BusinessError)
- [ ] Specific handling pakai `instanceof` check

### Async

- [ ] Tidak ada `.forEach(async ...)` tanpa `await Promise.all`
- [ ] Parallel pakai `Promise.all` atau `Promise.allSettled`
- [ ] Caller tidak lupa `await` atau `.catch()` untuk async fire-and-forget

### Boundary

- [ ] Repository lempar error mentah
- [ ] Service transform ke BusinessError
- [ ] Controller tidak try/catch business logic
- [ ] Global `AllExceptionsFilter` memformat response + log dengan correlation ID
- [ ] `false` dari adapter eksternal (misalnya FCM no-op) ditangani eksplisit oleh caller

### Response Format

- [ ] Format error response konsisten (`statusCode`, `message`, `code`, `context`)
- [ ] `code` dikirim ke client untuk programmatic handling
- [ ] `context` berisi ID/field yang relevan (tidak bocor data sensitif)

---

## Referensi

- [api-conventions.md](./api-conventions.md) — Format error envelope
- [clean-code.md](./clean-code.md) — Single responsibility di error handling
- [logging-observability.md](./logging-observability.md) — Log error dengan correlation ID
