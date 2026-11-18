# Modul `_template` (scaffold)

**Jangan** import `TemplateModule` di `src/app.module.ts`. Folder ini hanya skeleton — salin ke `src/modules/<nama>/`.

## Urutan kerja (salin dari `regional`)

1. **Schema** — `infrastructure/schema/` atau `src/database/schema/` + `bun run db:generate`.
2. **Repository** — `infrastructure/template.repository.ts` (extend `BaseRepository` bila perlu).
3. **Service** — `application/template.service.ts` (use case, `BusinessError`).
4. **Facade** — `facade/template.facade.ts` implements `TemplateApi`.
5. **Controller** — `presentation/template.controller.ts` + response DTO.
6. **API export** — `api/template.api.ts` (`TEMPLATE_API` token) + `api/index.ts`.
7. **Module** — wire providers; export `TEMPLATE_API` saja ke modul lain.
8. **Spec** — `*.spec.ts` per layer (lihat `regional`).

## Referensi

- Layering lengkap: `src/modules/regional/`
- Panduan CLI: `docs/scaffold-new-module.md`
- Boundary ESLint: `tools/eslint-rules/README.md`

## Setelah salin

```bash
bun run lint
bun test
bun run build
graphify update .
```