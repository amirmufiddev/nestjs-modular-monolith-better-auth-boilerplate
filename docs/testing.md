# Testing

Dokumen ini menjelaskan standar testing di backend ini — pola penulisan test, mocking, coverage, dan checklist yang harus dipenuhi.

## Foundation Layer Status (P1)

Foundation Layer P1 sudah ter-deliver. Konvensi test di repository ini memakai **`bun:test`** (built-in Bun, kompatibel dengan API Jest-like: `describe`/`it`/`expect`/`mock`). Beberapa implikasi penting:

- `tsconfig.build.json` **mengeksklusi** `*.spec.ts` agar build production tidak men-sertakan spec file (test tetap harus dijalankan terpisah).
- Pola `jest.resetModules()` / `jest.isolateModules()` **tidak tersedia** di `bun:test`; gunakan dynamic `import()` untuk skenario yang butuh modul terisolasi.
- Test ditulis **sebelum** implementasi (Red-Green-Refactor). Lihat skill `superpowers:test-driven-development`.
- Coverage difokuskan pada **use case (application layer)** dan adapter infrastructure; entity/DTO hanya membutuhkan type-check.

Sumber tunggal pola pemakaian aktual: `backend/src/shared/README.md` (semua shared module punya `*.spec.ts` co-located yang mengikuti konvensi di bawah).

## Daftar Isi

- [Setup & Menjalankan Tests](#setup--menjalankan-tests)
- [Struktur Test](#struktur-test)
- [Pola Mocking](#pola-mocking)
- [Coverage Target](#coverage-target)
- [Edge Cases & Test Isolation](#edge-cases--test-isolation)
- [Test Naming Convention](#test-naming-convention)
- [E2E Tests](#e2e-tests)
- [Checklist Testing](#checklist-testing)

---

## Setup & Menjalankan Tests

Test runner: **`bun:test`** (API Jest-compatible, sudah built-in di Bun). `tsconfig.build.json` mengecualikan `*.spec.ts` — jalankan test terpisah dari build.

```bash
bun test                       # Semua unit test
bun test --watch               # Watch mode
bun test --coverage            # Coverage report
bun test src/shared/realtime   # Test spesifik folder
```

> **Catatan:** Script di `package.json` masih menyebut `jest` (legacy). Runner yang dipakai saat eksekusi adalah `bun test` (lihat `bunfig.toml` jika ada, atau argumen langsung). Tanyakan sebelum mengubah script.

---

## Struktur Test

Tests berada di samping source file (co-located):

```text
src/
├── common/
│   ├── filters/
│   │   ├── http-exception.filter.ts
│   │   └── http-exception.filter.spec.ts   ← unit test
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── logging.interceptor.spec.ts
│   └── repository/
│       ├── base.repository.ts
│       └── base.repository.spec.ts
└── modules/
    └── order/
        ├── order.service.ts
        ├── order.service.spec.ts
        └── order-status.spec.ts
```

E2E tests berada di `test/`:

```text
test/
├── __helpers__/
│   ├── mock-session.ts       # Factory UserSession
│   ├── mock-org-id.ts        # UUID test constants
│   ├── mock-repository.ts    # BaseRepository mock factory
│   ├── test-app.factory.ts   # NestJS app factory untuk e2e
│   └── teardown.ts           # Cleanup setelah e2e
```

---

## Pola Mocking

### Service Unit Test (Constructor Injection)

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('UserService', () => {
  let service: UserService;
  let repo: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            save: mock(() => Promise.resolve(mockUser)),
            findOne: mock(() => Promise.resolve(mockUser)),
            find: mock(() => Promise.resolve([mockUser])),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should create user', async () => {
    const result = await service.create({ email: 'test@test.com' });
    expect(result).toEqual(mockUser);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@test.com' }),
    );
  });
});
```

> **bun:test vs Jest:** `bun:test` memakai `mock(() => ...)` alih-alih `jest.fn()`. `toHaveBeenCalledWith` dan matcher lain identik dengan Jest. `mock()` mengembalikan fungsi yang auto-spy + bisa di-reset via `mock.mockReset()`.

### Mock Manual (Tanpa `Test.createTestingModule`)

```typescript
import { mock } from 'bun:test';

const mockRepo = {
  findByOrganization: mock(() => Promise.resolve([...])),
  findById: mock(() => Promise.resolve(mockRecord)),
};

const service = new MyService(mockRepo as any, mockDb as any);
```

### Guard Unit Test (Fastify Context)

```typescript
const mockContext = {
  switchToHttp: () => ({
    getRequest: () => ({
      headers: { ... },
      rawBody: Buffer.from('...'),
    }),
  }),
} as unknown as ExecutionContext;
```

### Repository Test Helper

```typescript
import { mockBaseRepository } from 'test/__helpers__/mock-repository';

const mockRepo = mockBaseRepository<MyEntity>();
```

### Mock ConfigService

```typescript
import { mock } from 'bun:test';

const mockConfig = {
  get: mock((key: string) => {
    const map: Record<string, string> = {
      DATABASE_URL: 'postgresql://test',
      JWT_SECRET: 'test-secret-min-32-chars-XXXXXXXXXXXX',
    };
    return map[key];
  }),
  getOrThrow: mock((key: string) => {
    const map: Record<string, string> = {
      DATABASE_URL: 'postgresql://test',
    };
    if (!map[key]) throw new Error(`Missing ${key}`);
    return map[key];
  }),
};
```

### Mengisolasi Modul (Pengganti `jest.resetModules` / `jest.isolateModules`)

`bun:test` **tidak** punya `jest.resetModules()` atau `jest.isolateModules()`. Untuk skenario yang butuh modul benar-benar terisolasi (misal: side-effect module-level, singleton override, atau `setInterval` di top-level), gunakan **dynamic `import()`**:

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('OrderService (isolated module per test)', () => {
  beforeEach(() => {
    // Reset cache modul yang sudah di-import
    // (Bun: gunakan module path spesifik)
    Object.keys(require.cache)
      .filter((k) => k.includes('/order/'))
      .forEach((k) => delete require.cache[k]);
  });

  it('should use env A', async () => {
    process.env.ORDER_MODE = 'A';
    // Dynamic import = modul dieksekusi ulang dengan env baru
    const { OrderService } = await import('./order.service');
    const svc = new OrderService();
    expect(svc.mode).toBe('A');
  });

  it('should use env B', async () => {
    process.env.ORDER_MODE = 'B';
    const { OrderService } = await import('./order.service');
    const svc = new OrderService();
    expect(svc.mode).toBe('B');
  });
});
```

> **Catatan:** Pola di atas lebih reliable dibanding `jest.isolateModules` karena Bun's module cache dihapus eksplisit; namun tetap utamakan dependency injection (lebih clean) dibanding manipulasi cache.

### Test dengan Foundation Layer (RLS / SSE / Event Bus)

Konsumen `RlsContext`, `SseService`, dan event bus `@nestjs/event-emitter` harus menyertakan test setup yang mencerminkan perilaku runtime — lihat `backend/src/shared/README.md` untuk API dan contoh pemakaian aktual.

#### RlsContext — wrap manual untuk service test

```typescript
import { describe, it, expect } from 'bun:test';
import { RlsContext } from '@/shared/database/rls-context';

describe('InventoryService (with RlsContext)', () => {
  it('scopes query to organization ctx', async () => {
    let captured: string | undefined;
    const fakeRepo = {
      find: () => {
        captured = RlsContext.getCurrentOrganizationId();
        return Promise.resolve([{ id: 1 }]);
      },
    };
    // ❌ Bad — tanpa run(): captured = undefined → query gagal di real DB
    // await new InventoryService(fakeRepo as any).list();

    // ✅ Good — bungkus dengan run() meniru RlsInterceptor
    await RlsContext.run('organization-42', async () => {
      await new InventoryService(fakeRepo as any).list();
    });
    expect(captured).toBe('organization-42');
  });
});
```

> Layanan yang dipanggil dari HTTP diasumsikan sudah di-set context oleh `RlsInterceptor`. Test **tidak** boleh bergantung asumsi itu — selalu bungkus manual.

#### Domain event — pakai `EventEmitter2` mock atau in-memory

```typescript
import { describe, it, expect, mock } from 'bun:test';

it('OrderService emits order.created with correlation metadata', async () => {
  const emit = mock(() => {});
  const svc = new OrderService({ emit } as any);

  await svc.create({ productId: 'p-1', qty: 2 });

  expect(emit).toHaveBeenCalled();
  // Shape payload sesuai DomainEventMap — lihat backend/src/shared/README.md bagian 1
  expect(emit.mock.calls[0][0]).toBe('order.created');
});
```

> Untuk event listener test, prefer `Test.createTestingModule({ imports: [SharedEventsModule, OrderModule] })` agar listener ter-wiring nyata (lihat pola `*.spec.ts` co-located di `src/shared/events`).

#### SSE service — test handler return stream

```typescript
import { describe, it, expect, mock } from 'bun:test';

it('SseController.subscribe yields messages via SseService', async () => {
  const sse = { subscribe: mock(() => ({ pipe: () => ({}) })) };
  // SseService mock penuh (lihat *.spec.ts di src/shared/realtime) lebih akurat.
});
```

> Bentuk final subscription test mengikuti implementasi `SseService` di `src/shared/realtime/sse.service.ts`. Pola di atas hanya referensi; bukan pengganti spec aktual.

---

## Coverage Target

Coverage threshold umum:

| Metric     | Minimum |
| ---------- | ------- |
| Statements | 90%     |
| Branches   | 85%     |
| Functions  | 90%     |
| Lines      | 90%     |

### Fokus Coverage: Service & Use Case, Bukan Entity

> **Aturan:** Coverage dihitung bermakna bila berasal dari **business logic (service layer)** — yang menjalankan business flow end-to-end dengan dependency repository ter-mock via DIP. Entity/Schema/DTO cukup diverifikasi oleh type-check, bukan line coverage.

| Layer                                  | Wajib di-test?                                       | Alasan                                                 |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `services/` (business logic)           | Ya, ≥90%                                             | Business logic utama; paling banyak branch & edge case |
| `repositories/` (adapter, data access) | Ya, fokus pada error path & RLS context              | I/O boundary; query filter & tenant context            |
| `controllers/` (HTTP endpoints)        | Ya, minimal 1 happy-path + 1 error-path per endpoint | Verifikasi routing HTTP, guards, DTO validation        |
| `interfaces/`                          | Tidak (hanya type/token)                             | Kontrak murni & Symbol tokens                          |
| `*.module.ts`                          | Tidak                                                | Hanya wiring DI                                        |
| `*.dto.ts`                             | Tidak                                                | Schema class-validator, cukup type-check               |
| `main.ts`                              | Tidak (e2e cover)                                    | Bootstrap                                              |

### File yang Dikecualikan dari Coverage

- `*.module.ts` — NestJS DI config (cukup type-check)
- `main.ts` — Bootstrap (diuji via e2e)
- `*.dto.ts` — Data transfer objects (cukup type-check)
- `index.ts` — Barrel files (re-export saja)
- `interfaces/*.ts` — Abstraksi interface dan Symbol tokens
- `schema/*.ts` — Definisi schema Drizzle (tested via repository/migrations)

### Red-Green-Refactor (TDD)

Setiap fitur baru atau bugfix mengikuti siklus:

1. **Red** — tulis test gagal dulu (use case, error path, atau regresi). Pastikan test gagal karena logika belum ada, bukan karena setup salah.
2. **Green** — implementasi minimal yang lolos test. Jangan over-engineer.
3. **Refactor** — bersihkan duplication, perbaiki naming, pastikan test tetap hijau.

Lihat skill `superpowers:test-driven-development` untuk detail lengkap dan pair dengan skill `superpowers:verification-before-completion` sebelum klaim "done".

---

## Edge Cases & Test Isolation

### Coverage Red Flags

| Pattern                           | Severity    | Impact                                                       |
| --------------------------------- | ----------- | ------------------------------------------------------------ |
| Service tanpa spec file           | 🟡 Warning  | Business logic tidak terverifikasi                           |
| Test yang hit real DB             | 🔴 Critical | Slow tests, flake                                            |
| Test yang hit real HTTP           | 🔴 Critical | External dep, flake                                          |
| Test tanpa assertions             | 🟡 Warning  | False positive coverage                                      |
| Shared state antar test           | 🟡 Warning  | Test saling interfere                                        |
| Missing edge cases                | 🟡 Warning  | Bug tidak terdeteksi                                         |
| No mocking setup                  | 🟡 Warning  | Test tidak isolated                                          |
| Build sukses dianggap test sukses | 🔴 Critical | `tsconfig.build.json` exclude spec; build hijau ≠ test hijau |

### Test Isolation

```typescript
// ❌ Bad — Shared state
let createdUserId: string;

beforeAll(async () => {
  createdUserId = await createUser(); // Shared!
});

it('test A', () => {
  /* depends on createdUserId */
});
it('test B', () => {
  /* depends on createdUserId */
});

// ✅ Good — Fresh state per test
beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});
```

### Edge Case Coverage

```typescript
// ❌ Bad — Only happy path
describe('divide', () => {
  it('should divide', () => {
    expect(divide(10, 2)).toBe(5);
  });
});

// ✅ Good — Edge cases covered
describe('divide', () => {
  it('should divide positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should throw on division by zero', () => {
    expect(() => divide(10, 0)).toThrow(DivisionByZeroError);
  });

  it('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  it('should handle decimal results', () => {
    expect(divide(10, 3)).toBeCloseTo(3.333, 2);
  });

  it('should handle very large numbers', () => {
    expect(divide(Number.MAX_SAFE_INTEGER, 2)).toBeGreaterThan(0);
  });

  it('should handle zero numerator', () => {
    expect(divide(0, 5)).toBe(0);
  });
});
```

### Pattern Wajib di Service Test

Untuk service yang menulis (mutation), test harus mencakup:

1. **Happy path** — input valid → output sesuai
2. **Validation failure** — input invalid → throw `BusinessError.badRequest`
3. **Not found** — ID tidak ada → throw `BusinessError.notFound`
4. **Conflict** — duplicate → throw `BusinessError.conflict`
5. **Dependency error** — repository throw → propagate atau transform dengan benar
6. **Permission** — role tidak sesuai → throw `BusinessError.forbidden`

---

## Test Naming Convention

### File Naming

- Unit test co-located: `<name>.spec.ts`
- E2E test di `test/`: `<name>.e2e-spec.ts`

### `describe` & `it` Naming

```typescript
// ❌ Bad — Vague names
it('test 1', () => {});
it('works', () => {});
it('case', () => {});

// ✅ Good — Descriptive names
it('should return user when valid ID is provided', () => {});
it('should throw UserNotFoundError when user does not exist', () => {});
it('should hash password before saving to database', () => {});
```

**Pattern**:

- `describe(ClassName)` atau `describe('methodName')`
- `it('should <expected behavior> when <condition>')`

---

## E2E Tests

E2E tests menggunakan test database yang terpisah. Jalankan dengan:

```bash
# Setup database test terlebih dahulu
DATABASE_URL=postgresql://user:pass@localhost:5432/app_test bun run db:migrate

# Jalankan e2e
bun test test/                 # atau bun run test:e2e
```

> File e2e co-located: `test/*.e2e-spec.ts` (atau `test/**/*.e2e-spec.ts`). `tsconfig.build.json` mengecualikan pattern `*.spec.ts`/`*.e2e-spec.ts` dari build.

### Pola E2E

```typescript
describe('POST /api/orders', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create order', async () => {
    const session = mockSession({ role: 'customer' });
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ productId: 'uuid-here', quantity: 2 })
      .expect(201);

    expect(response.body).toMatchObject({
      statusCode: 201,
      data: { id: expect.any(String) },
    });
  });
});
```

---

## Deteksi Source File Tanpa Test

```bash
graphify query "find source files without corresponding test files"
graphify query "find test files that don't mock external dependencies"
graphify query "find complex business logic without test coverage"
```

---

## Checklist Testing

Setiap PR yang menambahkan service/controller/repo baru WAJIB memenuhi checklist ini:

### Test Wajib Ada

- [ ] Setiap `*.service.ts` punya `*.service.spec.ts`
- [ ] Setiap `*.controller.ts` punya minimal 1 happy-path + 1 error-path test
- [ ] Setiap `*.repository.ts` (jika custom) punya `*.repository.spec.ts`
- [ ] Setiap `*.guard.ts` / `*.interceptor.ts` / `*.filter.ts` punya test

### Kualitas Test

- [ ] Test di-isolate (tidak bergantung urutan eksekusi)
- [ ] Mock semua dependency eksternal (DB, HTTP, queue)
- [ ] Tidak ada `console.log` di test (pakai `Logger` mock atau assertion)
- [ ] Test punya assertion (tidak ada test "smoke" tanpa `expect`)
- [ ] Edge cases di-cover: not-found, conflict, validation error, forbidden

### Coverage

- [ ] Statements ≥90%
- [ ] Branches ≥85%
- [ ] Functions ≥90%
- [ ] Lines ≥90%

### Naming

- [ ] File co-located dengan source
- [ ] `describe(ClassName)` atau `describe('methodName')`
- [ ] `it('should <behavior> when <condition>')`

---

## Referensi

- [clean-code.md](./clean-code.md) — Single Responsibility yang tercermin dari testability
- [error-handling.md](./error-handling.md) — Test untuk semua branch BusinessError
- [security-guidelines.md](./security-guidelines.md) — Security test untuk auth/guard
