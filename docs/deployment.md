# Deployment & Configuration

Dokumen ini membahas environment variables, centralized configuration, scripts, dan operasional deployment untuk NestJS 11 boilerplate ini.

## Foundation Layer Status (P1)

Foundation Layer P1 sudah selesai dan deployment harus menjalankan shared events, RLS context, realtime SSE, serta push notification melalui konfigurasi environment. Local development dan production memakai Docker Compose; Traefik menjadi API Gateway untuk SSL termination, routing, dan load balancing. Detail komponen shared tersedia di [`src/shared/README.md`](../src/shared/README.md).

## Daftar Isi

- [Docker Compose & Traefik](#docker-compose--traefik)
- [Environment Variables](#environment-variables)
- [Centralized Config](#centralized-config)
- [Zod Validation Schema](#zod-validation-schema)
- [Type Coercion & Defaults](#type-coercion--defaults)
- [Scripts](#scripts)
- [Production](#production)
- [Checklist Configuration](#checklist-configuration)

---

## Docker Compose & Traefik

Docker Compose digunakan untuk local development dan deployment production agar konfigurasi service konsisten. Aplikasi dapat dijalankan dengan runtime Bun; Node.js tetap dapat dipakai selama adapter yang digunakan kompatibel dengan Bun.

Traefik berperan sebagai API Gateway di depan service backend:

- terminasi SSL di gateway;
- routing berdasarkan host/path;
- load balancing ke replica backend.

Contoh label router API:

```yaml
labels:
  - 'traefik.http.routers.api.rule=Host(`api.example.com`)'
```

Nilai host, credential, secret, dan konfigurasi environment lain harus berasal dari `.env` atau secret manager deployment, bukan hardcoded di source maupun Compose file.

---

## Environment Variables

Semua env vars divalidasi oleh Zod saat startup. Lihat `src/config/env.validation.ts` untuk schema lengkap dan `src/config/index.ts` untuk barrel.

### Required

| Variable             | Keterangan                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`)      |
| `BETTER_AUTH_URL`    | Base URL aplikasi (untuk cookie domain) — contoh: `http://localhost:2001` |
| `BETTER_AUTH_SECRET` | Secret key Better Auth (min 32 chars, random)                             |

### Optional (dengan default)

| Variable                   | Default                 | Keterangan                                       |
| -------------------------- | ----------------------- | ------------------------------------------------ |
| `NODE_ENV`                 | `development`           | `production` / `development` / `test`            |
| `PORT`                     | `2001`                  | Port HTTP server                                 |
| `DATABASE_SSL`             | `false`                 | Enable SSL untuk PostgreSQL                      |
| `REDIS_HOST`               | `localhost`             | Host Redis                                       |
| `REDIS_PORT`               | `6379`                  | Port Redis                                       |
| `REDIS_PASSWORD`           | —                       | Password Redis (opsional)                        |
| `REDIS_DB`                 | `0`                     | Redis DB index                                   |
| `CORS_ORIGINS`             | —                       | Comma-separated list origin yang diizinkan       |
| `SCALAR_AGENT_KEY`         | —                       | Agent key Scalar Cloud deployment                |
| `GOOGLE_CLIENT_ID`         | —                       | Google OAuth client ID (opsional)                |
| `GOOGLE_CLIENT_SECRET`     | —                       | Google OAuth client secret                       |
| `AI_KEY_ENCRYPTION_SECRET` | —                       | Base64 32 byte — enkripsi kunci per organization |
| `UPLOAD_DRIVER`            | `local`                 | `local` atau `s3`                                |
| `AWS_S3_BUCKET`            | —                       | S3 bucket name (jika driver s3)                  |
| `AUTH_URL`                 | `http://localhost:2001` | Override BETTER_AUTH_URL (port benar)            |
| `LOG_LEVEL`                | `info`                  | `debug` / `info` / `warn` / `error`              |
| `FALLBACK_LANGUAGE`        | `id`                    | Bahasa default i18n                              |

### Jika Menggunakan BullMQ

| Variable                  | Default | Keterangan                            |
| ------------------------- | ------- | ------------------------------------- |
| `BULLMQ_DEFAULT_ATTEMPTS` | `3`     | BullMQ job retry attempts             |
| `BULLMQ_BACKOFF_DELAY_MS` | `1000`  | BullMQ exponential backoff base delay |

### Integrasi WhatsApp (WAHA NOWEB)

Env vars untuk modul `whatsapp` (P5). Lihat `src/config/env.validation.ts`.

| Variable                           | Default                 | Keterangan                                      |
| ---------------------------------- | ----------------------- | ----------------------------------------------- |
| `WAHA_API_URL`                     | `http://localhost:3000` | Base URL instance WAHA                          |
| `WAHA_API_KEY`                     | —                       | API key untuk outgoing HTTP ke WAHA             |
| `WAHA_WEBHOOK_SECRET`              | —                       | Secret verifikasi webhook (wajib di production) |
| `WAHA_SESSION_NAME`                | `default`               | Nama sesi WAHA                                  |
| `WHATSAPP_DEFAULT_organization_ID` | —                       | organization default untuk order dari WhatsApp  |
| `WHATSAPP_PARSER_ENABLED`          | `true`                  | Aktifkan parser order intent dari pesan masuk   |
| `WHATSAPP_NOTIFY_STATUS_CHANGE`    | `true`                  | Notifikasi saat status sesi WAHA berubah        |

> **Catatan**: env vars WAJIB di-deklarasikan di `.env.example` (tanpa nilai).

---

## Centralized Config

**Tidak boleh** ada akses langsung `process.env` di luar folder `src/config/`. Semua akses harus lewat `ConfigService` (NestJS) atau namespace config (`configService.get('database.url')`).

### Aturan

1. **Single source of truth**: semua env var declaration di `src/config/env.validation.ts` (Zod schema).
2. **Typed namespace**: setiap area punya namespace config file (`database.config.ts`, `auth.config.ts`, `notification.config.ts`, `queue.config.ts`, dll.).
3. **Fail-fast**: missing required env → throw saat startup, BUKAN saat runtime.
4. **Type coercion**: Zod schema yang meng-handle parse (`z.coerce.number()`, `z.coerce.boolean()`).

### Lokasi Config Files

```text
src/config/
├── env.validation.ts     # Zod schema untuk SEMUA env vars
├── index.ts              # Barrel — export semua namespace
├── app.config.ts         # Global app config
├── auth.config.ts        # Better Auth secret, URL
├── database.config.ts    # DB URL, SSL, pool
├── redis.config.ts       # Redis host, port, password
├── notification.config.ts# Integrasi notifikasi (opsional, sesuaikan)
├── queue.config.ts       # BullMQ default job options (jika digunakan)
└── upload.config.ts      # Driver (local/s3), bucket
```

### Contoh Namespace Config

```typescript
// src/config/auth.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => {
  const baseUrl =
    process.env.AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:2001';
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required');
  }

  return {
    baseUrl,
    secret,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
});
```

### Konsumsi di Service

```typescript
// src/modules/user/user.service.ts
@Injectable()
export class UserService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepository,
  ) {}

  async getUploadBucket(): string {
    // ✅ Good — ambil via namespace config
    const bucket = this.configService.get<string>('upload.s3Bucket');
    if (!bucket) throw new Error('AWS_S3_BUCKET not configured');

    return bucket;
  }
}
```

---

## Zod Validation Schema

Pakai Zod untuk validasi semua env vars di startup. Schema lengkap di `src/config/env.validation.ts`.

```typescript
// src/config/env.validation.ts
import { z } from 'zod';

export const envSchema = z.object({
  // App
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(2001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  FALLBACK_LANGUAGE: z.enum(['id', 'en']).default('id'),

  // Database
  DATABASE_URL: z.url(),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // Auth (required)
  BETTER_AUTH_SECRET: z.string().min(32, 'Must be at least 32 chars'),
  BETTER_AUTH_URL: z.url(),
  AUTH_URL: z.url().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().port().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),

  // CORS
  CORS_ORIGINS: z.string().optional(),

  // Upload
  UPLOAD_DRIVER: z.enum(['local', 's3']).default('local'),
  AWS_S3_BUCKET: z.string().optional(),

  // Queue (jika menggunakan BullMQ)
  BULLMQ_DEFAULT_ATTEMPTS: z.coerce.number().int().positive().default(3),
  BULLMQ_BACKOFF_DELAY_MS: z.coerce.number().int().positive().default(1000),

  // Optional integrations (tambahkan sesuai kebutuhan proyek)
  AI_CHAT_BASE_URL: z.string().url().optional(),
  AI_KEY_ENCRYPTION_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SCALAR_AGENT_KEY: z.string().optional(),
});

// Parse & export — throws on invalid
export const env = envSchema.parse(process.env);
```

---

## Type Coercion & Defaults

### Selalu Parse Numeric/Boolean

```typescript
// ❌ Bad — String comparison untuk number
if (process.env.MAX_CONNECTIONS > 100) {
  // "50" > 100? lexicographic, hasilnya SALAH
}

// ✅ Good — Parse explicitly
const maxConnections = parseInt(process.env.MAX_CONNECTIONS || '10', 10);
if (maxConnections > 100) { ... }

// ✅ Better — Pakai Zod schema yang auto-coerce
z.coerce.number().default(10);
```

### Boolean Parsing

```typescript
// ❌ Bad — Truthy check yang misleading
if (process.env.FEATURE_ENABLED) {  // "false" string juga truthy!
  // ...
}

// ✅ Good — Explicit string comparison
if (process.env.FEATURE_ENABLED === 'true') { ... }

// ✅ Better — Zod coerce
z.coerce.boolean().default(false);
```

### Default Value untuk Secret — DILARANG

```typescript
// ❌ Bad — Default value untuk secret (security risk!)
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
// Default value membuat app boot dengan secret lemah

// ✅ Good — Fail-fast jika missing
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

// ✅ Better — Zod required()
BETTER_AUTH_SECRET: z.string().min(32),
```

---

## Scripts

```bash
# Development
bun run start:dev       # Hot reload dev server

# Production build
bun run build           # Compile TypeScript
bun run start:prod      # Jalankan dari dist/

# Database migrations
bun run db:generate     # Generate migration dari schema changes
bun run db:migrate      # Jalankan pending migrations
bun run db:studio       # Buka Drizzle Studio (browser)

# Testing
bun run test            # Unit tests
bun run test:cov        # Unit tests + coverage report
bun run test:e2e        # E2E tests

# Docs deploy
bun run docs:deploy     # Deploy API docs ke Scalar Cloud
```

---

## Production

1. Set `NODE_ENV=production` — ini menonaktifkan:
   - Stack trace di error responses
   - Body/query logging di interceptor
   - Swagger UI (hanya tersedia di development)

2. Pastikan Redis tersedia jika menggunakan BullMQ queue dan/atau cache.

3. `trust proxy: true` sudah aktif di Fastify — tidak perlu konfigurasi tambahan untuk reverse proxy.

4. Health check tersedia di `GET /health` — gunakan untuk readiness probe Kubernetes/Docker.

5. **WAJIB**:
   - Set `BETTER_AUTH_SECRET` ≥32 char random
   - Set `CORS_ORIGINS` dengan origin yang sah (bukan `*`)
   - Set `DATABASE_SSL=true` jika DB di cloud

---

## Configuration Red Flags

| Pattern                          | Severity      | Example                                      |
| -------------------------------- | ------------- | -------------------------------------------- |
| Hardcoded URL/host               | 🟡 Warning    | `fetch('https://api.prod.com/...')`          |
| Env var tanpa validation         | 🔴 Critical   | App crash saat runtime, bukan startup        |
| Missing `.env.example`           | 🟡 Warning    | Onboarding susah, missing env not detected   |
| `process.env` diakses scattered  | 🟡 Warning    | Tidak ada central config                     |
| Hardcoded port                   | 🟢 Suggestion | `app.listen(3000)` tanpa env option          |
| Boolean/number as string         | 🟡 Warning    | `process.env.PORT` langsung dipakai (string) |
| Default value untuk critical env | 🔴 Critical   | Fallback untuk SECRET yang harus required    |

---

## Checklist Configuration

Setiap PR yang menambahkan env var baru atau akses `process.env`:

### Env Declaration

- [ ] Env var baru dideklarasikan di `env.validation.ts` (Zod)
- [ ] Required env var pakai `.min(N)` / `.url()` / `.regex()` untuk validasi
- [ ] Optional env var punya `.default(value)` yang masuk akal
- [ ] Env var didokumentasikan di `.env.example` (tanpa nilai)

### Config Namespace

- [ ] Env var diakses via namespace config (`configService.get('namespace.key')`)
- [ ] Namespace config di-register di `src/config/index.ts`
- [ ] Module yang butuh config import namespace, bukan `process.env`

### Type Safety

- [ ] Numeric env var di-parse dengan `z.coerce.number()`
- [ ] Boolean env var di-parse dengan `z.coerce.boolean()`
- [ ] Tidak ada perbandingan string untuk number

### Security

- [ ] Secret TIDAK punya default value
- [ ] Secret minimal length divalidasi (`z.string().min(32)`)
- [ ] URL divalidasi (`z.url()`)

---

## Deteksi Pelanggaran

```bash
# Cari process.env di luar folder config/
grep -rn "process.env" src/ --include="*.ts" | grep -v "src/config/"

# Cari default value untuk env var secret
grep -rn "process.env.*||.*['\"]" src/

# Cari env var tanpa validation
grep -rn "process.env\." src/config/env.validation.ts | sort -u
# Compare dengan semua process.env access di codebase
```

```bash
# Pakai graphify
graphify query "find environment variables used without validation"
graphify query "find hardcoded URLs, hosts, or ports in source code"
graphify query "find missing .env.example or env documentation"
```

---

## Referensi

- [security-guidelines.md](./security-guidelines.md) — Env var secret & fail-fast
- [architecture.md](./architecture.md) — ConfigModule registration di AppModule
- [clean-code.md](./clean-code.md) — Single source of truth
