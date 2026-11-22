import { env, envSchema } from './env.validation';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should validate valid environment variables', () => {
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET =
      'a-very-long-secret-key-that-is-at-least-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:2001';
    process.env.PORT = '2001';

    // Dynamic import to test the schema definition

    const validEnv = {
      NODE_ENV: 'development',
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
    };

    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(2001);
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.FCM_CREDENTIALS_PATH).toBe('');
      expect(result.data.BASE_URL).toBe('http://localhost:2001');
    }
  });

  it('should accept a custom BASE_URL', () => {
    const envWithBaseUrl = {
      NODE_ENV: 'development',
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
      BASE_URL: 'https://api.example.com',
    };
    const result = envSchema.safeParse(envWithBaseUrl);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.BASE_URL).toBe('https://api.example.com');
    }
  });

  it('should reject invalid BASE_URL', () => {
    const envWithBadBaseUrl = {
      NODE_ENV: 'development',
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
      BASE_URL: 'not-a-valid-url',
    };
    const result = envSchema.safeParse(envWithBadBaseUrl);
    expect(result.success).toBe(false);
  });

  it('should parse FCM environment variables when provided', () => {
    const envWithFcm = {
      NODE_ENV: 'development',
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
      FCM_CREDENTIALS_PATH: 'keys/service-account.json',
    };

    const result = envSchema.safeParse(envWithFcm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FCM_CREDENTIALS_PATH).toBe(
        'keys/service-account.json',
      );
    }
  });

  it('should throw an error for missing required variables', () => {
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.BETTER_AUTH_SECRET =
      'a-very-long-secret-key-that-is-at-least-32-chars';
    process.env.BETTER_AUTH_URL = 'http://localhost:2001';

    const invalidEnv = {};
    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it('should parse environment variables into env object upon import', () => {
    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBeDefined();
  });

  describe('email environment variables', () => {
    const baseEnv = {
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
    };

    it('should apply defaults for all 6 email fields when omitted', () => {
      const result = envSchema.safeParse(baseEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.EMAIL_SECURE).toBe(false);
        expect(result.data.EMAIL_FROM_NAME).toBe('MyApp');
        expect(result.data.EMAIL_REPLY_TO).toBe('noreply@example.com');
        expect(result.data.EMAIL_TIMEOUT_MS).toBe(30_000);
        expect(result.data.EMAIL_MAX_RECIPIENTS_PER_JOB).toBe(50);
        expect(result.data.EMAIL_SUBJECT_PREFIX).toBe('[MyApp]');
      }
    });

    it('should coerce EMAIL_SECURE, EMAIL_TIMEOUT_MS, and EMAIL_MAX_RECIPIENTS_PER_JOB', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        EMAIL_SECURE: 'true',
        EMAIL_TIMEOUT_MS: '15000',
        EMAIL_MAX_RECIPIENTS_PER_JOB: '100',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.EMAIL_SECURE).toBe(true);
        expect(result.data.EMAIL_TIMEOUT_MS).toBe(15_000);
        expect(result.data.EMAIL_MAX_RECIPIENTS_PER_JOB).toBe(100);
      }
    });

    it('should reject invalid EMAIL_TIMEOUT_MS', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        EMAIL_TIMEOUT_MS: 'not-a-number',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('postgres environment variables', () => {
    const baseEnv = {
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
    };

    it('should apply defaults for postgres fields when omitted', () => {
      const result = envSchema.safeParse(baseEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.POSTGRES_HOST).toBe('localhost');
        expect(result.data.POSTGRES_PORT).toBe(5432);
        expect(result.data.POSTGRES_USER).toBe('postgres');
        expect(result.data.POSTGRES_PASSWORD).toBe('');
        expect(result.data.POSTGRES_DB).toBe('myapp');
      }
    });

    it('should coerce POSTGRES_PORT and accept custom values', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        POSTGRES_HOST: 'db.internal',
        POSTGRES_PORT: '5433',
        POSTGRES_USER: 'admin',
        POSTGRES_PASSWORD: 'secretpassword',
        POSTGRES_DB: 'customdb',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.POSTGRES_HOST).toBe('db.internal');
        expect(result.data.POSTGRES_PORT).toBe(5433);
        expect(result.data.POSTGRES_USER).toBe('admin');
        expect(result.data.POSTGRES_PASSWORD).toBe('secretpassword');
        expect(result.data.POSTGRES_DB).toBe('customdb');
      }
    });
  });

  describe('s3 and redis additional variables', () => {
    const baseEnv = {
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
    };

    it('should support S3_PORT, S3_CONSOLE_PORT, and EMAIL_UI_PORT', () => {
      const result = envSchema.safeParse(baseEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.S3_PORT).toBe(9000);
        expect(result.data.S3_CONSOLE_PORT).toBe(9001);
        expect(result.data.EMAIL_UI_PORT).toBe(8025);
        expect(result.data.BETTER_AUTH_INVITE_PATH).toBe(
          '/auth/accept-invitation',
        );
      }
    });

    it('should coerce ports and accept REDIS_URL', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        S3_PORT: '9100',
        S3_CONSOLE_PORT: '9101',
        EMAIL_UI_PORT: '8026',
        REDIS_URL: 'redis://default:secret@localhost:6379',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.S3_PORT).toBe(9100);
        expect(result.data.S3_CONSOLE_PORT).toBe(9101);
        expect(result.data.EMAIL_UI_PORT).toBe(8026);
        expect(result.data.REDIS_URL).toBe(
          'redis://default:secret@localhost:6379',
        );
      }
    });
  });
});
