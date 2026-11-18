# Konfigurasi Integrasi Opsional

Dokumen ini menjelaskan variabel lingkungan dan modul yang **tidak** diregister di `AppModule` default boilerplate. Aktifkan hanya jika Anda membutuhkan fitur terkait.

## WhatsApp (WAHA)

| Variabel | Deskripsi |
|----------|-----------|
| `WAHA_API_URL`, `WAHA_API_KEY`, `WAHA_WEBHOOK_SECRET`, … | Konfigurasi server WAHA dan webhook |

**Enable modul:** impor `WhatsappModule` dari `src/modules/whatsapp/infrastructure/whatsapp.module.ts` ke `app.module.ts`. Lihat `docs/samples/README.md`.

## Firebase Cloud Messaging (push)

| Variabel | Deskripsi |
|----------|-----------|
| `FCM_CREDENTIALS_PATH` | Path ke JSON service account Firebase Admin |

**Komponen:** `PushNotificationModule` sudah global; adapter no-op jika path kosong.

## AI assistant

| Variabel | Deskripsi |
|----------|-----------|
| `AI_KEY_ENCRYPTION_SECRET` | Enkripsi kunci provider di DB |

**Enable modul:** impor `AiAssistantModule` dan tambahkan `aiKeyConfig` ke `ConfigModule.forRoot({ load: [...] })`.

## BullMQ / broadcast queue

| Variabel | Deskripsi |
|----------|-----------|
| `BROADCAST_QUEUE_ENABLED`, `BULLMQ_REDIS_DB`, … | Antrian job (default `false` di boilerplate) |

## Inventory reconciliation cron

| Variabel | Deskripsi |
|----------|-----------|
| `INVENTORY_RECONCILIATION_*` | Cron domain inventori (tidak ada modul inventory di boilerplate default) |

## Referensi

- Startup default: `src/app.module.ts`
- Sample: `docs/samples/README.md`