# Modul contoh (WhatsApp & AI)

## Opsi penempatan

| Opsi | Pro | Kontra |
|------|-----|--------|
| **A. In-repo optional (default)** | Satu `bun test` / lint; mudah dicontoh | Repo lebih besar; migrasi historis domain |
| **B. Folder `examples/`** | Core repo lebih bersih | Duplikasi wiring, CI ganda, sync API sulit |
| **C. Package terpisah** | Versi independen | Overhead publish + injeksi ke monolith |

## Rekomendasi default

**Tetap opsi A** — kode di `src/modules/whatsapp/` dan `src/modules/ai-assistant/` **tidak** diregister di `AppModule` boilerplate. Dokumentasi tier: [`boilerplate-module-tiers.md`](./boilerplate-module-tiers.md).

## Kriteria ekstraksi (go/no-go)

Ekstrak ke `examples/` atau package **hanya jika**:

- [ ] Tim fork tidak akan pernah menjalankan WAHA/OpenAI.
- [ ] Anda siap memindahkan ~80+ file + test + schema whatsapp/ai.
- [ ] CI terpisah untuk contoh sudah disetup.

Jika salah satu belum terpenuhi → **no-go**.

## Jika ekstraksi dilakukan nanti

Checklist file bergerak:

| Area | Lokasi saat ini |
|------|-----------------|
| Modul Nest | `src/modules/whatsapp/`, `src/modules/ai-assistant/` |
| Schema | `src/database/schema/` (whatsapp, ai) |
| Event registry | `src/shared/events/domain-event-registry.ts` (entri terkait) |
| `AppModule` | Tambahan manual `WhatsappModule`, `AiAssistantModule`, `aiKeyConfig` |
| Test | `**/*.spec.ts` di bawah path modul tersebut |
| Env | `WAHA_*`, `OPENAI_*`, `AI_KEY_*` di `.env.example` |

Setelah pemindahan: `graphify update .`, perbarui [`configuration-optional-integrations.md`](./configuration-optional-integrations.md).

## Keputusan produk

Ekstraksi fisik **di luar scope** plan suggestion tanpa konfirmasi eksplisit pemilik repo. Dokumentasi tier sudah cukup untuk kebanyakan fork.