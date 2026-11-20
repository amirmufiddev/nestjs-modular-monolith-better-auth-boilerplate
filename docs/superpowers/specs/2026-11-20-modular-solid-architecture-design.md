# Design Document: Transformasi Arsitektur dari DDD ke Modular Monolith & SOLID

- **Tanggal:** 2026-11-20
- **Status:** Approved
- **Topik:** Migrasi arsitektur boilerplate dari Domain-Driven Design (DDD) multi-layer ke Modular Monolith idiomatik NestJS dengan penegakan 5 Prinsip SOLID (SRP, OCP, LSP, ISP, DIP).

---

## 1. Latar Belakang & Motivasi

Sebelumnya, boilerplate ini mengusung konsep "Modular monolith dengan filosofi DDD pragmatis". Dalam implementasinya, beberapa modul (`member`, `regional`, dan `_template`) diorganisasi ke dalam lapisan-lapisan DDD:
- `api/` (DTO publik, injection token API)
- `application/` (use-case orchestration)
- `domain/` (domain entities & value objects — sering kali kosong atau minimal)
- `facade/` (implementasi public API modul yang membungkus application service)
- `infrastructure/` (Drizzle repositories, bridge listeners, schema khusus)
- `presentation/` (controllers & DTO HTTP)

Namun, pola ini menimbulkan beberapa permasalahan:
1. **Inkonsistensi Arsitektur:** Modul lain seperti `rbac`, `upload`, `email`, dan `health` tidak menggunakan struktur DDD tersebut, melainkan struktur fitur NestJS standar (`controllers/`, `services/`, `repositories/`, `dto/`).
2. **Over-Engineering & Lapisan Berlebih:** Keberadaan `facade/` dan folder `domain/` yang kosong menambah tingkat kedalaman direktori (cognitive overhead) tanpa memberikan manfaat nyata bagi fungsionalitas modul.
3. **Kepatuhan SOLID yang Belum Merata:** Dependency Inversion Principle (DIP) belum diterapkan secara konsisten pada lapisan database access (banyak service masih bergantung langsung pada class konkret repository Drizzle alih-alih abstraksi interface).

Tujuan dari desain ini adalah menyatukan seluruh modul ke dalam **Modular Monolith yang idiomatik untuk NestJS** dengan penegakan disiplin **5 Prinsip SOLID** secara konsisten.

---

## 2. Struktur Modul Standar (Modular Idiomatik)

Setiap modul domain bisnis di `src/modules/<nama_modul>/` akan mengikuti struktur seragam:

```text
src/modules/<nama_modul>/
├── controllers/
│   ├── <nama_modul>.controller.ts        # [SRP] HTTP routing, guards, interceptors, Swagger
│   └── <nama_modul>.controller.spec.ts   # Unit test controller
├── services/
│   ├── <nama_modul>.service.ts           # [SRP] Logika bisnis, validasi aturan bisnis, event dispatching
│   └── <nama_modul>.service.spec.ts      # Unit test service (menggunakan mock repository)
├── repositories/
│   ├── <nama_modul>.repository.ts        # [SRP & DIP] Akses data konkret berbasis Drizzle ORM
│   └── <nama_modul>.repository.spec.ts   # Unit test repository
├── interfaces/
│   ├── <nama_modul>-repository.interface.ts # [ISP & DIP] Kontrak repository + Injection Token
│   ├── <nama_modul>-service.interface.ts    # [ISP] Kontrak public service bila dikonsumsi modul lain
│   └── index.ts                             # Export seluruh interface dan token modul
├── dto/
│   ├── create-<nama_modul>.dto.ts        # [SRP] Validasi payload request via class-validator
│   ├── update-<nama_modul>.dto.ts        # [SRP] Validasi payload update
│   └── <nama_modul>-response.dto.ts      # [SRP] Serialisasi & struktur respons API
├── <nama_modul>.module.ts                # [OCP] Konfigurasi dependency injection NestJS
└── index.ts                              # Boundary Gate: Titik akses publik untuk modul lain
```

---

## 3. Penerapan 5 Prinsip SOLID

### 3.1. Single Responsibility Principle (SRP)
- **Controller:** Bertanggung jawab mutlak hanya pada protokol HTTP (ekstraksi params, body, query, session user dari Fastify request) dan mendelegasikan eksekusi langsung ke Service. Controller tidak boleh menjalankan raw SQL / Drizzle query atau logika bisnis kompleks.
- **Service:** Bertanggung jawab mutlak pada aturan bisnis, verifikasi otorisasi/invarian data, dan orkestrasi pemanggilan repository. Maksimal 300 baris kode per service.
- **Repository:** Bertanggung jawab mutlak pada persistensi data (query database Drizzle, filtering, pagination via `BaseRepository`, soft delete). Tidak boleh mengandung logika HTTP atau exception formatting.
- **DTO:** Bertanggung jawab mutlak pada validasi bentuk data input dan struktur data output.

### 3.2. Open/Closed Principle (OCP)
- **Extensible Providers via Strategy/Token:** Komponen eksternal seperti Object Storage (`upload`) diisolasi di balik interface `IObjectStorageService`. Penambahan adapter baru (misal S3, MinIO, R2) dilakukan dengan membuat class baru yang mengimplementasikan interface tersebut tanpa mengubah `UploadService`.
- **Event-Driven Extension:** Efek samping dari suatu use case (seperti pencatatan audit trail, pengiriman email verifikasi, dan invalidasi cache RBAC) dipicu melalui event `EventEmitter2`. Modul atau listener baru dapat ditambahkan tanpa memodifikasi kode use-case utama.

### 3.3. Liskov Substitution Principle (LSP)
- Seluruh class implementasi repository (misal `MemberRepository` berbasis Drizzle) wajib mematuhi seluruh kontrak method pada interface `IMemberRepository`.
- Implementasi mock (`MockMemberRepository` atau `InMemoryMemberRepository`) dapat disubstitusikan secara penuh ke dalam `MemberService` pada unit test tanpa mengubah ekspektasi perilaku program atau menimbulkan runtime error yang tak terduga.
- Tipe kembalian untuk pengecekan data bersifat konsisten: `Promise<T | null>` untuk pencarian tunggal dan `Promise<T[]>` untuk pencarian majemuk, bukan melempar error tak terduga di lapisan repository.

### 3.4. Interface Segregation Principle (ISP)
- Interface dirancang terfokus dan ramping (idealnya \(\le 5\) sampai 7 method per interface).
- Jika sebuah modul memiliki operasi pembacaan dan penulisan yang kompleks, atau kapabilitas tambahan (misal link generation), interface dipisahkan secara spesifik sehingga client tidak dipaksa bergantung pada method yang tidak mereka gunakan.

### 3.5. Dependency Inversion Principle (DIP)
- Modul tingkat tinggi (`MemberService`) **tidak bergantung pada modul tingkat rendah (`MemberRepository` konkret)**. Keduanya bergantung pada abstraksi (`IMemberRepository` dan `MEMBER_REPOSITORY_TOKEN`).
- Injeksi dependensi dilakukan melalui NestJS Injection Token:
  ```typescript
  // interfaces/member-repository.interface.ts
  export const MEMBER_REPOSITORY_TOKEN = Symbol('MEMBER_REPOSITORY_TOKEN');

  export interface IMemberRepository {
    findById(id: string): Promise<MemberRecord | null>;
    findByOrgAndUser(orgId: string, userId: string): Promise<MemberRecord | null>;
    listByOrg(orgId: string, query: ListMemberQuery): Promise<PaginatedResult<MemberRecord>>;
    create(data: NewMemberRecord): Promise<MemberRecord>;
    updateRole(id: string, role: string): Promise<MemberRecord>;
    delete(id: string): Promise<void>;
  }

  // services/member.service.ts
  @Injectable()
  export class MemberService {
    constructor(
      @Inject(MEMBER_REPOSITORY_TOKEN)
      private readonly memberRepo: IMemberRepository,
      private readonly eventEmitter: EventEmitter2,
    ) {}
  }

  // member.module.ts
  @Module({
    controllers: [MemberController],
    providers: [
      MemberService,
      {
        provide: MEMBER_REPOSITORY_TOKEN,
        useClass: MemberRepository,
      },
    ],
    exports: [MemberService, MEMBER_REPOSITORY_TOKEN],
  })
  export class MemberModule {}
  ```

---

## 4. Komunikasi Antar Modul & Batasan Arsitektur

### 4.1. Gate Publik (`index.ts`)
Setiap modul memiliki file `index.ts` di root modul yang menjadi satu-satunya gerbang resmi:
```typescript
// src/modules/member/index.ts
export * from './member.module';
export * from './services/member.service';
export * from './interfaces';
export * from './dto/member-response.dto';
export * from './dto/invite-member.dto';
export * from './dto/update-member-role.dto';
```
Modul lain dilarang keras mengimpor file di dalam subfolder internal (`controllers/`, `repositories/`, `services/`).

### 4.2. Penyesuaian Rule ESLint (`no-cross-module-import`)
File `tools/eslint-rules/no-cross-module-import.mjs` diperbarui:
- **Pelanggaran:** Impor lintas modul yang merujuk langsung ke subfolder internal:
  - `../<other_module>/controllers/...`
  - `../<other_module>/services/...`
  - `../<other_module>/repositories/...`
  - `../<other_module>/infrastructure/...`
  - `../<other_module>/domain/...`
- **Diizinkan:** Impor yang merujuk ke root modul:
  - `../<other_module>`
  - `../<other_module>/index`
  - `src/modules/<other_module>`
  - `src/modules/<other_module>/interfaces` (bila diakses kontraknya secara langsung)

### 4.3. Komunikasi Asinkron (Event Bus)
Untuk aksi lintas modul yang tidak memerlukan return value langsung (misal: mengirim email undangan, invalidasi cache hak akses RBAC, logging aktivitas), modul memancarkan event ke `EventEmitter2` menggunakan type-safe registry `DomainEventMap` di `src/shared/events/domain-event-registry.ts`.

---

## 5. Rencana Migrasi per Modul

### 5.1. Modul `_template/` (Scaffold Blueprint)
- Hapus folder `api/`, `application/`, `facade/`, `infrastructure/`, `presentation/`.
- Buat folder `controllers/`, `services/`, `repositories/`, `interfaces/`, `dto/`.
- Sediakan `template.repository.interface.ts` dengan `TEMPLATE_REPOSITORY_TOKEN`.
- Sediakan `index.ts` yang mengekspos `TemplateModule`, `TemplateService`, `interfaces`, dan DTO.
- Perbarui `_template/README.md`.

### 5.2. Modul `regional/`
- Hapus folder `api/`, `application/`, `facade/`, `infrastructure/`, `presentation/`.
- Pindahkan `regional.controller.ts` ke `controllers/`.
- Pindahkan `regional.service.ts` ke `services/`.
- Pindahkan `regional.repository.ts` ke `repositories/`.
- Pindahkan DTO ke `dto/`.
- Buat `interfaces/regional-repository.interface.ts` dengan `REGIONAL_REPOSITORY_TOKEN`.
- Buat `index.ts` root modul.
- Sesuaikan `regional.module.ts` dan unit test (`*.spec.ts`).

### 5.3. Modul `member/`
- Hapus folder `api/`, `application/`, `facade/`, `domain/`, `infrastructure/`, `presentation/`.
- Pindahkan `member.controller.ts` ke `controllers/`.
- Pindahkan `member.service.ts` ke `services/`.
- Pindahkan `member.repository.ts` ke `repositories/`.
- Pindahkan `member-accepted.bridge.ts` ke `listeners/` atau `services/`.
- Pindahkan schema `pending-member-link.schema.ts` ke `repositories/schemas/` atau `src/database/schema/`.
- Pindahkan DTO ke `dto/`.
- Buat `interfaces/member-repository.interface.ts` dengan `MEMBER_REPOSITORY_TOKEN`.
- Gantikan penggunaan token `MEMBER_API` di modul lain/Better Auth hooks dengan injeksi `MemberService` langsung melalui `index.ts`.
- Sesuaikan `member.module.ts` dan seluruh test (`*.spec.ts`).

### 5.4. Modul `upload/`
- Pindahkan `s3-object-storage.service.ts` ke `adapters/s3-object-storage.adapter.ts`.
- Buat `interfaces/object-storage.interface.ts` dengan `OBJECT_STORAGE_TOKEN`.
- `UploadService` menginjeksi `@Inject(OBJECT_STORAGE_TOKEN) private readonly storage: IObjectStorageService`.
- Sediakan `index.ts` root modul.

### 5.5. Modul `rbac/`
- Buat interface dan injection token untuk `OrganizationRoleRepository` (`ORGANIZATION_ROLE_REPOSITORY_TOKEN`) dan `RbacPermissionRepository` (`RBAC_PERMISSION_REPOSITORY_TOKEN`).
- Pastikan `index.ts` modul `rbac` mengekspos public services, decorators, types, dan DTOs secara rapi.

### 5.6. Modul `email/` & `health/`
- Pastikan memiliki `index.ts` yang bersih dan konsisten.

---

## 6. Pembaruan Dokumentasi & Rules

File dokumentasi berikut wajib diperbarui untuk mencerminkan arsitektur baru:
1. `docs/architecture.md`: Menghapus bab DDD pragmatis; menggantinya dengan Arsitektur Modular Monolith & SOLID.
2. `docs/modular-monolith.md`: Menyesuaikan struktur folder internal modul dan aturan komunikasi antar modul.
3. `docs/clean-code.md`: Memperbarui contoh implementasi SOLID dengan Injection Token repository.
4. `docs/scaffold-new-module.md`: Memperbarui panduan scaffold modul baru sesuai blueprint `_template`.
5. `.cursor/rules/modular-architecture.mdc`: Memperbarui petunjuk folder modul dan aturan boundary import.

---

## 7. Rencana Pengujian & Verifikasi

Sebelum refactoring dinyatakan selesai, seluruh pengujian berikut harus lulus:
1. **ESLint Boundary:** `bun run lint` lolos 0 error dan mendeteksi/mencegah import ilegal ke subfolder internal modul lain.
2. **Unit & Integration Tests:** `bun test` berhasil menjalankan seluruh test suites dengan hasil **PASS** (100% green).
3. **Build Validation:** `bun run build` sukses melakukan kompilasi TypeScript tanpa ada error type mismatch atau missing exports.
