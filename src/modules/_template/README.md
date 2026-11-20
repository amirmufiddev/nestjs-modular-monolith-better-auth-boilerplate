# Modul `_template` (Modular SOLID Blueprint)

Blueprint resmi untuk pembuatan modul baru dengan arsitektur **Modular Monolith** dan prinsip **SOLID** pada NestJS 11.

> **PENTING:** **Jangan** import `TemplateModule` langsung di `src/app.module.ts`. Folder ini berfungsi sebagai skeleton/template — salin ke `src/modules/<nama-modul>/` saat membuat modul baru.

---

## Struktur Folder

```
src/modules/_template/
├── interfaces/                          # Kontrak & abstraksi (DIP & ISP)
│   ├── template-repository.interface.ts # ITemplateRepository & TEMPLATE_REPOSITORY_TOKEN
│   └── index.ts
├── dto/                                 # Data Transfer Objects & validasi
│   ├── create-template.dto.ts           # Input DTO dengan class-validator & Swagger
│   ├── update-template.dto.ts           # PartialType DTO
│   ├── template-response.dto.ts         # Response DTO (hindari expose raw entity)
│   └── index.ts
├── controllers/                         # HTTP Layer (Single Responsibility)
│   ├── template.controller.ts           # REST endpoint + @RequirePermission guard
│   └── template.controller.spec.ts
├── services/                            # Business Logic Layer
│   ├── template.service.ts              # Injeksi ITemplateRepository via Symbol Token
│   └── template.service.spec.ts
├── repositories/                        # Data Access Layer
│   ├── template.repository.ts           # Implementasi ITemplateRepository
│   └── template.repository.spec.ts
├── template.module.ts                   # Wiring dependency injection & provider tokens
├── index.ts                             # Public entrypoint module (Boundary ESLint)
└── README.md
```

---

## Prinsip SOLID yang Diterapkan

1. **Single Responsibility Principle (SRP):**
   - `controller`: Hanya menangani parsing HTTP request, routing, status code, dan otorisasi permission.
   - `service`: Menangani domain validation dan aturan bisnis (orchestrating data & melempar `BusinessError`).
   - `repository`: Bertanggung jawab atas persistensi data (query ke database atau storage).

2. **Open/Closed Principle (OCP):**
   - Service bergantung pada abstraksi repository (`ITemplateRepository`), sehingga implementasi persistensi (Drizzle, in-memory, mock) dapat diganti tanpa mengubah logic service.

3. **Liskov Substitution Principle (LSP):**
   - Setiap implementasi `ITemplateRepository` dapat saling menggantikan tanpa merusak perilaku `TemplateService`.

4. **Interface Segregation Principle (ISP):**
   - Interface dibuat fokus dan minimal sesuai kebutuhan modul, tidak memaksakan method yang tidak digunakan.

5. **Dependency Inversion Principle (DIP):**
   - `TemplateService` tidak bergantung langsung pada class konkret `TemplateRepository`, melainkan menginjeksi token `TEMPLATE_REPOSITORY_TOKEN` yang mengacu ke interface `ITemplateRepository`.

---

## Urutan Kerja Scaffold Modul Baru

1. **Salin Folder:**
   ```bash
   cp -r src/modules/_template src/modules/<nama-modul>
   ```
2. **Database Schema (bila modul memiliki tabel database):**
   - Buat schema di `src/database/schema/<nama-modul>.ts`.
   - Export di `src/database/schema/index.ts`.
   - Jalankan `bun run db:generate`.
3. **Repository:**
   - Ubah `repositories/<nama-modul>.repository.ts` untuk meng-extend `BaseRepository<typeof namaTable>` dari `src/common/repository/base.repository.ts`.
4. **Service:**
   - Sesuaikan use case di `services/<nama-modul>.service.ts`.
   - Gunakan `BusinessError` untuk error typed bisnis (`notFound`, `conflict`, `badRequest`, dll).
5. **Controller & DTO:**
   - Sesuaikan rute endpoint, DTO input/output, Swagger decorator, dan `@RequirePermission('resource:action')`.
6. **Module Wiring:**
   - Daftarkan controller dan provider di `<nama-modul>.module.ts`:
     ```typescript
     @Module({
       controllers: [<Nama>Controller],
       providers: [
         <Nama>Service,
         {
           provide: <NAMA>_REPOSITORY_TOKEN,
           useClass: <Nama>Repository,
         },
       ],
       exports: [<Nama>Service, <NAMA>_REPOSITORY_TOKEN],
     })
     export class <Nama>Module {}
     ```
7. **Public Entrypoint (`index.ts`):**
   - Ekspor hanya yang diizinkan untuk dikonsumsi modul lain (`Module`, `Service`, `interfaces`, `DTO`).
   - ESLint rule `modular-monolith/no-cross-module-import` melarang modul lain mengimpor subfolder internal secara langsung.
8. **Register ke `AppModule`:**
   - Tambahkan `<Nama>Module` ke array `imports` di `src/app.module.ts`.

---

## Pengujian & Verifikasi

Setelah membuat atau mengubah modul:

```bash
bun test src/modules/<nama-modul>/
bun run lint
bun test
bun run build
```
