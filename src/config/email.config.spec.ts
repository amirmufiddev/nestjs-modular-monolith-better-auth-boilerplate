import { buildEmailConfig } from './email.config';
import type { EnvConfig } from './env.validation';

const baseEnv = {
  NODE_ENV: 'development' as const,
  PORT: 2001,
  APP_NAME: 'MyApp',
  APP_VERSION: '',
  CORS_ORIGINS: 'http://localhost:5173',
  FALLBACK_LANGUAGE: 'id',
  BASE_URL: 'http://localhost:2001',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_DB: 0,
  REDIS_KEY_PREFIX: 'app',
  BETTER_AUTH_REDIS_DB: 1,
  BETTER_AUTH_REDIS_PREFIX: 'better-auth:',
  BROADCAST_QUEUE_ENABLED: true,
  BULLMQ_REDIS_DB: 2,
  BULLMQ_DEFAULT_ATTEMPTS: 3,
  BULLMQ_BACKOFF_DELAY_MS: 1000,
  BULLMQ_CONCURRENCY: 5,
  BETTER_AUTH_URL: 'http://localhost:2001',
  BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
  BETTER_AUTH_PATH: '/v1/auth',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  BETTER_AUTH_CLIENT_URL: 'http://localhost:5173',
  BETTER_AUTH_ERROR_PATH: '/auth/error',
  BETTER_AUTH_INVITE_PATH: '/accept-invite',
  EMAIL_ENABLED: false,
  EMAIL_HOST: 'smtp.example.com',
  EMAIL_PORT: 587,
  EMAIL_SECURE: false,
  EMAIL_USER: '',
  EMAIL_PASSWORD: '',
  EMAIL_FROM: 'noreply@example.com',
  EMAIL_FROM_NAME: 'MyApp',
  EMAIL_REPLY_TO: 'noreply@example.com',
  EMAIL_TIMEOUT_MS: 30_000,
  EMAIL_MAX_RECIPIENTS_PER_JOB: 50,
  EMAIL_SUBJECT_PREFIX: '[MyApp]',
  FCM_CREDENTIALS_PATH: '',
} satisfies EnvConfig;

describe('Email Config', () => {
  it('should map validated email env fields to EmailConfig', () => {
    const config = buildEmailConfig({
      ...baseEnv,
      EMAIL_ENABLED: true,
      EMAIL_SECURE: true,
      EMAIL_HOST: 'mail.test.local',
      EMAIL_PORT: 465,
      EMAIL_USER: 'user@test.local',
      EMAIL_PASSWORD: 'secret',
      EMAIL_FROM: 'from@test.local',
      EMAIL_FROM_NAME: 'Test organization',
      EMAIL_REPLY_TO: 'reply@test.local',
      EMAIL_TIMEOUT_MS: 15_000,
      EMAIL_MAX_RECIPIENTS_PER_JOB: 25,
      EMAIL_SUBJECT_PREFIX: '[Test]',
    });

    expect(config).toEqual({
      enabled: true,
      host: 'mail.test.local',
      port: 465,
      secure: true,
      auth: { user: 'user@test.local', pass: 'secret' },
      from: 'from@test.local',
      fromName: 'Test organization',
      replyTo: 'reply@test.local',
      connectionTimeoutMs: 15_000,
      greetingTimeoutMs: 15_000,
      socketTimeoutMs: 15_000,
      maxRecipientsPerJob: 25,
      defaultSubjectPrefix: '[Test]',
    });
  });

  it('should treat empty EMAIL_REPLY_TO as undefined', () => {
    const config = buildEmailConfig({
      ...baseEnv,
      EMAIL_REPLY_TO: '   ',
    });

    expect(config.replyTo).toBeUndefined();
  });

  it('should apply schema defaults for email fields', () => {
    const config = buildEmailConfig(baseEnv);

    expect(config.enabled).toBe(false);
    expect(config.secure).toBe(false);
    expect(config.fromName).toBe('MyApp');
    expect(config.connectionTimeoutMs).toBe(30_000);
    expect(config.maxRecipientsPerJob).toBe(50);
    expect(config.defaultSubjectPrefix).toBe('[MyApp]');
  });
});
