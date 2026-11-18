# Pengembangan lokal

## Knowledge graph (graphify)

Repo memiliki knowledge graph di `graphify-out/` (opsional untuk fork).

| Perintah | Kapan |
|----------|--------|
| `graphify query "<pertanyaan>"` | Orientasi arsitektur sebelum refactor besar |
| `graphify path "<A>" "<B>"` | Jalur dependensi antar simbol |
| `graphify explain "<konsep>"` | Node terkait konsep |
| `graphify update .` | **Setelah** menambah/mindah modul atau path signifikan (AST-only) |

Contoh setelah modul baru:

```bash
graphify update .
graphify query "regional module layering"
```

Artefak `graphify-out/` mengikuti `.gitignore` kebijakan repo Anda; jangan commit jika tidak diperlukan.

## Scaffold modul

Lihat [`scaffold-new-module.md`](./scaffold-new-module.md) dan `src/modules/_template/`.

## Quality gates

```bash
bun run lint    # termasuk modular-monolith/no-cross-module-import
bun test
bun run build
```

Rujuk [`testing.md`](./testing.md).