# Scaffold modul baru

## Opsi (a): salin `_template`

1. Salin folder `src/modules/_template/` → `src/modules/<nama>/`.
2. Ganti prefix `Template` → `PascalCase` modul Anda.
3. Ikuti urutan di [`src/modules/_template/README.md`](../src/modules/_template/README.md).
4. Daftarkan `YourModule` di `src/app.module.ts`.
5. Tambah schema Drizzle + migrasi jika perlu.
6. `graphify update .`

## Opsi (b): Nest CLI lalu restructure

```bash
nest g module modules/foo --no-spec
nest g controller modules/foo/presentation/foo --no-spec
nest g service modules/foo/application/foo --no-spec
```

Pindahkan file ke layout:

```text
modules/foo/
├── api/           # token + interface + DTO publik
├── application/
├── facade/
├── infrastructure/
├── presentation/
└── foo.module.ts
```

Hapus export default yang melanggar boundary; expose hanya `FOO_API` dari `api/`.

## Checklist boundary

- [ ] Modul lain hanya `import ... from '@/modules/<other>/api/...'`
- [ ] `eslint.config.mjs` aktif: `modular-monolith/no-cross-module-import`
- [ ] Controller pakai response DTO + Swagger decorators
- [ ] Repository tidak dipanggil dari modul lain

Referensi implementasi: `src/modules/regional/`.

Rule detail: [`tools/eslint-rules/README.md`](../tools/eslint-rules/README.md).