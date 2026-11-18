import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.env.NODE_ENV !== 'test') {
  const envPath = resolve(process.cwd(), '.env');
  try {
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  } catch (error) {
    console.warn(
      `[EnvLoader] Warning: Failed to load .env file from ${envPath}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(2001),
    APP_NAME: z.string().default('MyApp'),
    APP_VERSION: z.string().default(''),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173,http://localhost:5174'),
    FALLBACK_LANGUAGE: z.string().default('id'),
    BASE_URL: z.string().url().default('http://localhost:2001'),
    DATABASE_URL: z.string().url(),
    /** Redis (cache adapter) **/
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
    REDIS_DB: z.coerce.number().int().min(0).default(0),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_KEY_PREFIX: z.string().min(1).default('app'),
    BETTER_AUTH_REDIS_DB: z.coerce.number().int().min(0).max(15).default(1),
    BETTER_AUTH_REDIS_PREFIX: z.string().default('better-auth:'),
    /** BullMQ Broadcast Push Queue **/
    BROADCAST_QUEUE_ENABLED: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    BULLMQ_REDIS_DB: z.coerce.number().int().min(0).max(15).default(2),
    BULLMQ_DEFAULT_ATTEMPTS: z.coerce.number().int().positive().default(3),
    BULLMQ_BACKOFF_DELAY_MS: z.coerce.number().int().positive().default(1000),
    BULLMQ_CONCURRENCY: z.coerce.number().int().positive().default(5),
    /** BetterAuth Configuration **/
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_PATH: z.string().default('/v1/auth'),
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    BETTER_AUTH_CLIENT_URL: z.string().url(),
    BETTER_AUTH_ERROR_PATH: z.string().default('/auth/error'),
    BETTER_AUTH_INVITE_PATH: z.string().default('/accept-invite'),
    /** Email Configuration **/
    EMAIL_ENABLED: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    EMAIL_HOST: z.string().default('localhost'),
    EMAIL_PORT: z.coerce.number().int().positive().default(587),
    EMAIL_SECURE: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(false),
    EMAIL_USER: z.string().optional().default(''),
    EMAIL_PASSWORD: z.string().optional().default(''),
    EMAIL_FROM: z.string().default('noreply@example.com'),
    EMAIL_FROM_NAME: z.string().default('MyApp'),
    EMAIL_REPLY_TO: z.string().default('noreply@example.com'),
    EMAIL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    EMAIL_MAX_RECIPIENTS_PER_JOB: z.coerce
      .number()
      .int()
      .positive()
      .default(50),
    EMAIL_SUBJECT_PREFIX: z.string().default('[MyApp]'),
    /** Firebase Cloud Messaging (FCM) — path ke JSON Admin SDK **/
    FCM_CREDENTIALS_PATH: z.string().optional().default(''),
    /** Object storage (S3-compatible, mis. MinIO) **/
    S3_ENDPOINT: z.string().url().default('http://127.0.0.1:9000'),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
    S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
    S3_BUCKET: z.string().min(1).default('uploads'),
    S3_FORCE_PATH_STYLE: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === 'true' || v === '1')
      .default(true),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        const origins = data.CORS_ORIGINS.split(',').map((s) => s.trim());
        return !origins.includes('*');
      }
      return true;
    },
    {
      message: 'Wildcard origin (*) is not allowed in production',
      path: ['CORS_ORIGINS'],
    },
  );

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .map(([key, val]) => `  ${key}: ${val?.join(', ')}`)
      .join('\n');
    throw new Error(
      `❌ Environment configuration validation failed:\n\n${message}\n\n` +
        `🔧 Fix: Review .env file and ensure all required variables are properly set.\n` +
        `📖 See .env.example for reference configuration.`,
    );
  }
  return result.data;
}

export const env = envSchema.parse(process.env);

/** Validated environment — single source of truth for config factories. */
export const validatedEnv = env;
