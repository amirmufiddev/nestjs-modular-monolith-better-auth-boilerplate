# Modul Sample Opsional

Kode di bawah ini **bukan** bagian dari startup default. Gunakan sebagai referensi pola modular monolith.

## Core (terdaftar di `AppModule`)

| Modul | Peran |
|-------|--------|
| `auth`, `member`, `rbac` | Multi-tenant + Better Auth |
| `regional` | Contoh CRUD berlapis (api → application → facade → infrastructure → presentation) |
| `upload`, `email`, `health` | Infrastruktur umum |
| `notification` | Contoh notifikasi in-app + event |
| `payment` | Contoh pembayaran / metode bayar (tanpa modul order domain) |

## Opsional (registrasi manual)

| Modul | Lokasi | Catatan |
|-------|--------|---------|
| WhatsApp / WAHA | `src/modules/whatsapp/` | Integrasi eksternal, ~80 file |
| AI assistant | `src/modules/ai-assistant/` | OpenAI + admin config; runtime boilerplate = handoff |

### Menambahkan WhatsApp ke `AppModule`

```typescript
import { WhatsappModule } from './modules/whatsapp/infrastructure/whatsapp.module';

@Module({
  imports: [
    // ...
    WhatsappModule,
  ],
})
export class AppModule {}
```

### Menambahkan AI assistant

```typescript
import { AiAssistantModule } from './modules/ai-assistant/infrastructure/ai-assistant.module';
import { aiKeyConfig } from './config';

ConfigModule.forRoot({
  load: [appConfig, authConfig, emailConfig, aiKeyConfig, queueConfig],
});
```

## Boundary modul

Import lintas modul hanya dari `modules/<name>/api/`. Rule ESLint: `modular-monolith/no-cross-module-import` (lihat `docs/anti-patterns-reference.md`).