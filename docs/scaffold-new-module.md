# Scaffold Modul Baru

Dokumen ini menjelaskan panduan membuat modul baru dengan arsitektur **Modular Monolith** dan **5 Prinsip SOLID** pada NestJS 11.

---

## Opsi (a): Salin `_template` (Disarankan)

Blueprint resmi tersedia di [`src/modules/_template/`](../src/modules/_template/).

1. Salin folder template:
   ```bash
   cp -r src/modules/_template src/modules/<nama>
   ```
2. Ganti nama file dan kelas:
   - Ganti `template` / `Template` menjadi nama modul Anda (kebab-case untuk file, PascalCase untuk class).
   - Buat Symbol token repository di `interfaces/<nama>-repository.interface.ts`:
     ```typescript
     export const <NAMA>_REPOSITORY_TOKEN = Symbol('<NAMA>_REPOSITORY_TOKEN');
     ```
3. Ikuti urutan detail di [`src/modules/_template/README.md`](../src/modules/_template/README.md).
4. Daftarkan `<Nama>Module` di `src/app.module.ts`.
5. Tambah schema Drizzle di `src/database/schema/<nama>.ts` + migrasi jika modul memiliki tabel database.
6. Jalankan pengujian:
   ```bash
   bun test src/modules/<nama>/
   bun run lint
   bun run build
   ```

---

## Opsi (b): Nest CLI lalu Restructure

Jika membuat dari awal via Nest CLI:

```bash
nest g module modules/foo --no-spec
nest g controller modules/foo/controllers/foo --no-spec
nest g service modules/foo/services/foo --no-spec
```

Lengkapi layout folder sesuai blueprint:

```text
src/modules/foo/
├── interfaces/                          # Abstraksi interface & Symbol token (DIP & ISP)
│   ├── foo-repository.interface.ts      # IFooRepository & FOO_REPOSITORY_TOKEN
│   └── index.ts
├── dto/                                 # DTO validasi request & response envelope (SRP)
│   ├── create-foo.dto.ts
│   ├── update-foo.dto.ts
│   ├── foo-response.dto.ts
│   └── index.ts
├── controllers/                         # HTTP routing, guards, Swagger (SRP)
│   ├── foo.controller.ts
│   └── foo.controller.spec.ts
├── services/                            # Aturan bisnis & orkestrasi (SRP & DIP)
│   ├── foo.service.ts
│   └── foo.service.spec.ts
├── repositories/                        # Drizzle ORM data persistence (SRP, LSP, DIP)
│   ├── foo.repository.ts
│   └── foo.repository.spec.ts
├── foo.module.ts                        # DI Provider wiring (OCP)
├── index.ts                             # Boundary gate publik resmi
└── README.md
```

### Wiring Provider pada `foo.module.ts`:

```typescript
@Module({
  controllers: [FooController],
  providers: [
    FooService,
    {
      provide: FOO_REPOSITORY_TOKEN,
      useClass: FooRepository,
    },
  ],
  exports: [FooService, FOO_REPOSITORY_TOKEN],
})
export class FooModule {}
```

### Public Entrypoint (`src/modules/foo/index.ts`):

```typescript
export * from './foo.module';
export * from './services/foo.service';
export * from './interfaces';
export * from './dto';
```

---

## Checklist Boundary & Kualitas

- [ ] Modul lain hanya mengimpor dari root `@/modules/<nama>` (`index.ts`) atau `@/modules/<nama>/interfaces`.
- [ ] ESLint `modular-monolith/no-cross-module-import` aktif dan lolos: tidak ada impor langsung ke subfolder internal (`controllers/`, `services/`, `repositories/`, dll.).
- [ ] Dependency Inversion (DIP): Service menginjeksi `@Inject(<NAMA>_REPOSITORY_TOKEN) private readonly repo: I<Nama>Repository`, bukan class konkret repository.
- [ ] Single Responsibility (SRP): Controller hanya menangani HTTP/Guards/Swagger; logika bisnis di Service; query database di Repository.
- [ ] Controller mengembalikan Response DTO (`*-response.dto.ts`), bukan entity DB mentah.
- [ ] Error bisnis menggunakan `BusinessError` typed helper (bukan generic `throw new Error()`).
- [ ] Repository extend `BaseRepository` jika entitas memiliki ID, timestamps, atau soft-delete (`deletedAt`).
- [ ] Unit test co-located (`*.spec.ts`) menggunakan mock repository untuk pengujian service.

Referensi implementasi: `src/modules/regional/` dan `src/modules/member/`.

Rule detail: [`tools/eslint-rules/README.md`](../tools/eslint-rules/README.md).