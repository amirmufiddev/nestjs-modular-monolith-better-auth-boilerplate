import { buildAppConfig } from './app.config';
import type { EnvConfig } from './env.validation';

const baseEnv = {
  NODE_ENV: 'development' as const,
  PORT: 2001,
  APP_NAME: 'MyApp',
  APP_VERSION: '',
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
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
  EMAIL_HOST: 'localhost',
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

describe('App Config', () => {
  it('should return app configuration mapped from validated env', () => {
    const config = buildAppConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      PORT: 8080,
      APP_VERSION: '1.2.3',
    });

    expect(config).toEqual(
      expect.objectContaining({
        nodeEnv: 'production',
        port: 8080,
        appVersion: '1.2.3',
        corsOrigins: ['http://localhost:5173', 'http://localhost:5174'],
      }),
    );
  });
});
