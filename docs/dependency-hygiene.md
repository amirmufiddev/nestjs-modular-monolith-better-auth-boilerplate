# Pemeliharaan dependensi (depcheck)

Setelah memangkas modul optional (tier doc), beberapa dependency npm mungkin tidak lagi direferensikan langsung.

## Menjalankan depcheck

```bash
bun run depcheck
```

Script memanggil [`depcheck`](https://github.com/depcheck/depcheck) (devDependency). Jalankan juga setelah menghapus folder modul atau memindahkan sample ke luar repo.

## Kandidat yang sering “unused” setelah fork minimal

Cross-check dengan `package.json` sebelum menghapus — banyak dipakai transitive atau hanya di modul optional:

| Package | Terkait modul |
|---------|----------------|
| `openai` | `src/modules/ai-assistant/` |
| `firebase-admin` | `src/shared/push-notification/` |
| `@nestjs/bullmq`, `bullmq` | queue / broadcast (default off) |
| `@nestjs/platform-socket.io`, `@nestjs/websockets` | realtime |
| `@scalar/nestjs-api-reference` | dev OpenAPI UI |
| `nest-winston` / Winston transports | logging (core — jangan hapus tanpa pengganti) |

## Aturan aman

1. **Jangan hapus** dep yang masih dipakai di test/mock (`test/`, `**/*.spec.ts`).
2. Jalankan `bun run build` dan `bun test` setelah setiap penghapusan dependency.
3. Dependency Better Auth / Drizzle / Nest sering tampil “unused” di depcheck karena dynamic import — verifikasi manual dengan `rg` sebelum uninstall.

## CI (opsional)

Tambahkan job non-blocking: `bun run depcheck || true` untuk awareness, bukan gate merge keras.