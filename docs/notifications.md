# Notifikasi — Panduan & Pattern

## Foundation Layer Status (P1)

Foundation Layer P1 sudah selesai untuk jalur push notification dasar. FCM tersedia melalui `FcmAdapter`, event domain menjadi pemicu pengiriman, dan token driver saat ini dilayani oleh repository in-memory stub. Implementasi aktual dirujuk di [`src/shared/README.md`](../src/shared/README.md).

## Overview

Sistem notifikasi menggunakan pattern **event-driven** dengan opsional **queue** (BullMQ + Redis) untuk pengiriman asinkron ke berbagai channel (email, push notification, SMS, WhatsApp, dll.).

> **Catatan:** BullMQ/queue bersifat opsional dan diaktifkan jika project membutuhkan pengiriman asinkron atau retry logic. Untuk kebutuhan sederhana, notifikasi bisa dikirim langsung dari listener tanpa queue.

## Flow

```text
Event terjadi (domain action)
       ↓
EventEmitter2.emit('resource.action', payload)
       ↓
NotificationListener menangkap event
       ↓
  ┌────────────────────────────────────┐
  │  Tanpa Queue (sinkron)             │
  │  NotificationService.send()        │
  │         ↓                          │
  │  Channel Adapter (Email/Push/SMS)  │
  └────────────────────────────────────┘
              ATAU
  ┌──────────────────────────────────────────┐
  │  Dengan Queue (asinkron, opsional)       │
  │  NotificationService.queue() → BullMQ    │
  │         ↓                                │
  │  NotificationProcessor (worker)          │
  │         ↓                                │
  │  Channel Adapter (Email/Push/SMS)        │
  └──────────────────────────────────────────┘
       ↓
External API / SMTP Server / Push Service
```

## Komponen

### `NotificationService`

- Titik masuk utama untuk mengirim atau meng-queue notifikasi
- Simpan log notifikasi ke DB (opsional, untuk audit trail)
- Mendukung multi-channel: tentukan channel target di payload event

### `NotificationListener`

- `@OnEvent()` handler yang mendengarkan domain event
- Mapping event → channel + template yang sesuai
- Memanggil `NotificationService.send()` atau `.queue()`

### `NotificationProcessor` (opsional, jika pakai BullMQ)

- BullMQ worker yang memproses job dari queue
- Retry otomatis dengan backoff strategy
- Dead letter queue untuk job yang gagal berulang

### Channel Adapters

Setiap channel diimplementasikan sebagai adapter/client terpisah:

| Adapter          | Fungsi                                                       |
| ---------------- | ------------------------------------------------------------ |
| `EmailClient`    | Kirim email via SMTP / third-party API (SendGrid, SES, dll.) |
| `PushClient`     | Kirim push notification (FCM, APNs, dll.)                    |
| `SmsClient`      | Kirim SMS via gateway (Twilio, dll.)                         |
| `WhatsAppClient` | Kirim pesan WhatsApp via API provider                        |

Setiap adapter mengimplementasikan interface `NotificationChannel` agar mudah di-swap atau ditambah channel baru.

## FCM Push Notification Foundation

Adapter FCM berada di `backend/src/shared/push-notification/fcm.adapter.ts` dan di-expose melalui `PushNotificationModule`. Adapter memuat Firebase Admin secara lazy dengan import modular:

```typescript
import { initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
```

Jika credential FCM kosong atau tidak lengkap, adapter berjalan dalam **no-op fallback** yang ramah development dan tidak menyebabkan aplikasi crash.

### `PushPayload`

Payload push menggunakan interface terkontrak berikut:

```typescript
interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}
```

### Driver Token

`DriverTokenRepository` saat ini adalah stub in-memory untuk menyimpan dan mengambil token driver. Implementasi DB-backed direncanakan pada fase berikutnya; jangan menganggap stub ini sebagai persistence production.

### Trigger dari Domain Event

Pengiriman push dipicu listener domain event, misalnya `OrderBroadcastEvent`, bukan dengan coupling langsung dari modul bisnis ke Firebase. Listener mengambil token melalui `DriverTokenRepository`, membentuk `PushPayload`, lalu memanggil `FcmAdapter`.

Event lain seperti perubahan status order dapat memakai pola yang sama. Gunakan event payload yang terkontrak dan jangan meneruskan entity mentah.

---

## Webhook Guard (Pattern)

Jika menerima webhook callback dari external service, gunakan guard dengan verifikasi HMAC signature:

### Alur Verifikasi

1. Ambil signature dari request header (contoh: `x-webhook-signature`)
2. Validasi body JSON dan extract identifier (contoh: `sessionId`, `eventId`)
3. Lookup secret yang sesuai dari DB berdasarkan identifier
4. Hitung HMAC SHA-256 dari body menggunakan secret
5. Bandingkan signature menggunakan `timingSafeEqual` (timing-safe, tidak vulnerable ke timing attack)

### Contoh Implementasi

```typescript
@Injectable()
export class WebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-webhook-signature'];
    const body = JSON.stringify(request.body);

    const secret = this.getSecretForRequest(request.body);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }
}
```

## Template Notifikasi

Template tersedia di `src/modules/notification/templates/`. Setiap event memiliki template tersendiri, dinamai sesuai event (contoh: `resource-created`, `payment-completed`).

Pattern penamaan: `<resource>-<action>.<channel>` (contoh: `order-created.email.hbs`, `order-created.sms.txt`).

## Konfigurasi

Env vars untuk notification channel (sesuaikan dengan channel yang digunakan):

| Var                            | Keterangan                                                 |
| ------------------------------ | ---------------------------------------------------------- |
| `NOTIFICATION_DEFAULT_CHANNEL` | Channel default (email / push / sms)                       |
| `SMTP_HOST`                    | Host SMTP server                                           |
| `SMTP_PORT`                    | Port SMTP server                                           |
| `SMTP_USER`                    | Username SMTP                                              |
| `SMTP_PASS`                    | Password SMTP                                              |
| `PUSH_FCM_PROJECT_ID`          | Firebase project ID untuk FCM                              |
| `PUSH_FCM_CREDENTIALS`         | Path ke service account JSON                               |
| `SMS_PROVIDER_URL`             | Base URL SMS gateway                                       |
| `SMS_PROVIDER_API_KEY`         | API key SMS provider                                       |
| `NOTIFICATION_QUEUE_ENABLED`   | Aktifkan BullMQ queue (`true` / `false`, default: `false`) |
| `REDIS_HOST`                   | Host Redis (wajib jika queue diaktifkan)                   |
| `REDIS_PORT`                   | Port Redis (wajib jika queue diaktifkan)                   |

> **Tip:** Gunakan `@nestjs/config` dengan `registerAs()` untuk mengelompokkan env vars per channel. Lihat [configuration.md](./configuration.md) untuk detail pattern konfigurasi.
