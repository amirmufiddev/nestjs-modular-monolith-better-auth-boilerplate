# Clean Code — Panduan Prinsip SOLID & Standar Kode

Dokumen ini merangkum standar penulisan kode yang berlaku di backend ini. Aturan ini menjadi acuan saat code review, refactor, dan onboarding developer baru.

## Status Foundation Layer

**P1 selesai.** Foundation Layer menerapkan beberapa keputusan clean-code yang harus diikuti modul bisnis: kontrak event melalui registry type-safe, adapter FCM untuk menyembunyikan provider eksternal, `SseService` untuk isolasi pub/sub realtime, factory `BusinessError` untuk error yang konsisten, dan rule ESLint `modular-monolith/no-cross-module-import` untuk menjaga boundary module. Contoh API tersedia di [`src/shared/README.md`](../src/shared/README.md).

## Daftar Isi

- [Prinsip SOLID](#prinsip-solid)
- [Foundation Layer sebagai Contoh SOLID](#foundation-layer-sebagai-contoh-solid)
- [Function Complexity](#function-complexity)
- [Naming Convention](#naming-convention)
- [Code Duplication](#code-duplication)
- [Checklist Code Review](#checklist-code-review)

---

## Prinsip SOLID

| Principle                 | Cek                        | Red Flag                                |
| ------------------------- | -------------------------- | --------------------------------------- |
| **S**ingle Responsibility | 1 class = 1 alasan berubah | Class >300 baris, >5 public methods     |
| **O**pen/Closed           | Extend tanpa modify        | Banyak switch/if-else untuk tipe        |
| **L**iskov Substitution   | Subclass bisa ganti parent | Override yang throw exception           |
| **I**nterface Segregation | Interface kecil & fokus    | Interface >5 methods                    |
| **D**ependency Inversion  | Depend on abstraction      | Import concrete class di business logic |

### Single Responsibility — Detail

- **Service** idealnya ≤300 baris. Jika lebih, pecah menjadi service yang lebih fokus (contoh: `BalanceService` → `BalanceQueryService` + `BalanceMutationService`).
- **Controller** idealnya ≤4 endpoint. Jika lebih (god controller), pecah berdasarkan concern (contoh: `OwnerWaController` → `QrController`, `PairingController`, `SessionController`).
- Constructor injection ≤5 dependency. Jika lebih, pecah service menjadi beberapa service terfokus.

### Open/Closed — Detail

- Hindari `switch` besar di tengah service. Gunakan **registry pattern** atau **strategy pattern**.
- Contoh di codebase: `WahaWebhookService` sebelumnya punya monolithic `switch (event)`, sekarang didelegasikan ke handler registry via `Map<string, WahaEventHandler>`.
- Provider eksternal (seperti Object Storage) diisolasi dengan interface dan adapter terpisah tanpa mengubah consumer (`UploadService`).

### Dependency Inversion — Detail

- Service bisnis TIDAK boleh bergantung langsung pada class konkret repository (Drizzle ORM) atau concrete class dari modul lain. Service dan data layer harus bergantung pada abstraksi interface dan Symbol Injection Token.
- Modul lain hanya boleh berinteraksi via public gate root `index.ts`, interface token, atau domain event (`EventEmitter2.emit('domain.event', payload)`).

#### Contoh Implementasi DIP dengan Symbol Injection Token

```typescript
// 1. Definisikan kontrak interface & Symbol Token di interfaces/
// File: src/modules/member/interfaces/member-repository.interface.ts
export const MEMBER_REPOSITORY_TOKEN = Symbol('MEMBER_REPOSITORY_TOKEN');

export interface IMemberRepository {
  findById(id: string): Promise<MemberRecord | null>;
  findByOrgAndUser(orgId: string, userId: string): Promise<MemberRecord | null>;
  create(data: NewMemberRecord): Promise<MemberRecord>;
  updateRole(id: string, role: string): Promise<MemberRecord>;
  delete(id: string): Promise<void>;
}

// 2. Service tingkat tinggi bergantung pada interface melalui @Inject(TOKEN)
// File: src/modules/member/services/member.service.ts
@Injectable()
export class MemberService {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: IMemberRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getMember(id: string): Promise<MemberRecord> {
    const member = await this.memberRepo.findById(id);
    if (!member) throw BusinessError.notFound('Member', id);
    return member;
  }
}

// 3. Wire token ke concrete class di NestJS Module
// File: src/modules/member/member.module.ts
@Module({
  controllers: [MemberController],
  providers: [
    MemberService,
    {
      provide: MEMBER_REPOSITORY_TOKEN,
      useClass: MemberRepository, // Drizzle concrete implementation
    },
  ],
  exports: [MemberService, MEMBER_REPOSITORY_TOKEN],
})
export class MemberModule {}
```

**Keuntungan Pengujian (Testability & LSP):**
Dalam unit test `MemberService`, implementasi mock repository in-memory dapat disubstitusikan secara penuh tanpa memerlukan koneksi database nyata:

```typescript
// File: src/modules/member/services/member.service.spec.ts
const mockMemberRepo: IMemberRepository = {
  findById: jest.fn(),
  findByOrgAndUser: jest.fn(),
  create: jest.fn(),
  updateRole: jest.fn(),
  delete: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [
    MemberService,
    { provide: MEMBER_REPOSITORY_TOKEN, useValue: mockMemberRepo },
    { provide: EventEmitter2, useValue: { emit: jest.fn() } },
  ],
}).compile();
```

## Foundation Layer sebagai Contoh SOLID

Foundation P1 memusatkan concern teknis tanpa memindahkan business rule ke shared layer:

- **Event registry (OCP/ISP):** `DomainEventMap` dapat diperluas oleh modul melalui declaration merging. `EventPayload<K>` dan `EventName<N, A>` menjaga kontrak kecil tanpa registry switch besar.
- **FCM adapter (DIP/SRP):** modul bisnis menginjeksi `FcmAdapter`, bukan mengimpor `firebase-admin` atau membangun credential sendiri. Adapter menangani modular initialization, no-op fallback, dan logging provider.
- **SSE service (SRP):** `SseService` memiliki tanggung jawab channel subscription dan publication. Controller hanya mengekspos stream; module bisnis tidak menyentuh `Subject` internal.
- **BusinessError factories (DRY/OCP):** gunakan factory yang sudah tersedia untuk kode/status/context konsisten, bukan mengulang konstruktor `BusinessError` di banyak service.
- **Module boundary enforcement:** `modular-monolith/no-cross-module-import` menolak import lintas module ke subfolder internal (`controllers/`, `services/`, `repositories/`, `infrastructure/`, `domain/`, dll.) dari luar `index.ts` atau `interfaces/`. Lint adalah guardrail, bukan pengganti desain interface.

## Tooling Enforcement

- Jalankan unit test Foundation Layer dengan Bun test; bila memakai API test Bun, gunakan import dari `bun:test`.
- Gunakan pola file co-located `*.spec.ts` agar test mudah ditemukan dan dipelihara dekat source.
- `tsconfig.build.json` mengecualikan file `*.spec.ts` dari build produksi. Selalu jalankan test terpisah; build yang sukses tidak membuktikan seluruh spec lulus.
- Jalankan ESLint untuk memeriksa `modular-monolith/no-cross-module-import` sebelum menganggap boundary module valid.

---

## Function Complexity

### Metrics Batas

| Indikator                      | Batas     | Tindakan                         |
| ------------------------------ | --------- | -------------------------------- |
| Panjang function               | ≤30 baris | Split ke helper function         |
| Cyclomatic complexity          | ≤10       | Extract branch ke named function |
| Jumlah parameter               | ≤4        | Gunakan object/DTO               |
| Nesting (if/for/try bersarang) | ≤3        | Early return / extract method    |

### Contoh: Extract Method

```typescript
// ❌ Bad — nesting dalam, tanggung jawab bercampur
async updateMemberRole(memberId: string, role: string) {
  const member = await this.memberRepo.findById(memberId);
  if (member) {
    if (member.role !== role) {
      const allowed = await this.rbac.canAssign(role);
      if (allowed) {
        member.role = role;
        await this.memberRepo.save(member);
        await this.audit.log({ memberId, role });
      }
    }
  }
}

// ✅ Good — extract to private methods, early return
async updateMemberRole(memberId: string, role: string) {
  const member = await this.memberRepo.findById(memberId);
  if (!member) throw BusinessError.notFound('Member', memberId);
  if (member.role === role) return;

  await this.assertCanAssignRole(role);
  await this.applyRole(member, role);
  await this.recordAudit(memberId, role);
}
```

---

## Naming Convention

| Element     | Convention        | Bad Example        | Good Example                |
| ----------- | ----------------- | ------------------ | --------------------------- |
| Class       | PascalCase, Noun  | `data`, `process`  | `UserRepository`            |
| Function    | camelCase, Verb   | `data()`, `user()` | `getUserById()`             |
| Boolean     | is/has/can prefix | `active`, `valid`  | `isActive`, `hasPermission` |
| Constant    | UPPER_SNAKE       | `maxRetry`         | `MAX_RETRY_COUNT`           |
| DTO         | PascalCase + Dto  | `CreateUserInput`  | `CreateUserDto`             |
| Controller  | PascalCase + Ctrl | `User`             | `UserController`            |
| Repository  | PascalCase + Repo | `Users`            | `UserRepository`            |
| Test file   | `<name>.spec.ts`  | `user.test.ts`     | `user.service.spec.ts`      |
| Env var     | UPPER_SNAKE       | `dbUrl`            | `DATABASE_URL`              |
| Boolean env | Flag prefix       | `IS_PRODUCTION` OK | `ENABLE_CACHE`, `IS_PROD`   |

### Naming untuk File

- **Lokasi**: co-located dengan source (`member.service.ts` + `member.service.spec.ts`).
- **Suffix** sesuai peran: `.controller.ts`, `.service.ts`, `.repository.ts`, `.dto.ts`, `.module.ts`, `.guard.ts`, `.middleware.ts`, `.interceptor.ts`, `.filter.ts`.

---

## Code Duplication

### Deteksi

Gunakan graphify untuk menemukan function yang相似:

```bash
graphify query "find functions with similar implementation across modules"
graphify query "find repeated pagination boilerplate"
```

### Aturan Anti-Duplikasi

| Pola Duplikasi                          | Solusi                                       |
| --------------------------------------- | -------------------------------------------- |
| Pagination `{ limit, offset }` tersebar | Pakai `PaginationDto` global via `@Query()`  |
| Error throwing boilerplate              | Pakai `BusinessError.notFound/conflict(...)` |
| Repository boilerplate CRUD             | Extend `BaseRepository<TTable>`              |
| Notification per-modul manual           | Pakai `NotificationService` terpusat         |
| Audit log per-modul manual              | Pakai `EventEmitter2.emit('audit.*')`        |

### Contoh Before/After

```typescript
// ❌ Bad — duplikasi di 6+ service
async findAll(limit?: string, offset?: string) {
  const pagination = {
    limit: parseInt(limit ?? '20'),
    offset: parseInt(offset ?? '0'),
  };
  return this.repo.findMany({ limit: pagination.limit, offset: pagination.offset });
}

// ✅ Good — pakai PaginationDto
async findAll(@Query() pagination: PaginationDto) {
  return this.repo.findMany({ limit: pagination.limit, offset: pagination.offset });
}
```

---

## Checklist Code Review

Gunakan checklist ini saat melakukan code review:

### Clean Code

- [ ] Class ≤300 baris, ≤5 public methods
- [ ] Function ≤30 baris, cyclomatic complexity ≤10
- [ ] Parameter ≤4
- [ ] Nesting ≤3 (gunakan early return)
- [ ] Naming sesuai konvensi (PascalCase/camelCase, prefix boolean)
- [ ] Tidak ada magic number — extract ke constant atau config

### SOLID

- [ ] 1 class = 1 alasan berubah (SRP)
- [ ] Tidak ada `switch` besar di tengah logic — gunakan registry/strategy (OCP)
- [ ] Implementasi konkret dapat saling menggantikan kontrak interface (LSP)
- [ ] Interface kecil dan terfokus (≤5 sampai 7 method) (ISP)
- [ ] Injeksi dependensi data layer menggunakan Symbol token (`@Inject(TOKEN)`) dan interface abstrak (DIP)
- [ ] Boundary modul diakses lewat public gate root `index.ts` atau `interfaces` (ESLint `no-cross-module-import`)

### DRY (Don't Repeat Yourself)

- [ ] Tidak ada copy-paste code antar file
- [ ] Pagination pakai `PaginationDto` global
- [ ] Error pakai `BusinessError` helper
- [ ] Audit pakai event emitter, bukan direct import

### Catatan

> Aturan "aturan cleanup" bukan dogma. Kadang trade-off pragmatis dibolehkan (misalnya parameter object lebih readable daripada DTO untuk helper internal). Yang penting: **ada alasan yang jelas** saat melanggar aturan.

---

## Referensi

- [architecture.md](./architecture.md) — Layer separation & dependency direction
- [modular-monolith.md](./modular-monolith.md) — Bounded context & module coupling
- [testing.md](./testing.md) — Pola testing yang mencerminkan struktur clean code
