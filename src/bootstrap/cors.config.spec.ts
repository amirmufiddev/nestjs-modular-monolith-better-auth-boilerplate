import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { configureCors } from './cors.config';
import { envSchema } from '../config/env.validation';

describe('CORS Configuration & Validation', () => {
  describe('envSchema CORS_ORIGINS validation', () => {
    const baseEnv = {
      PORT: '2001',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
      BETTER_AUTH_URL: 'http://localhost:2001',
      BETTER_AUTH_CLIENT_URL: 'http://localhost:3000',
      WAHA_WEBHOOK_SECRET: 'supersecret',
    };

    it('should allow wildcard * when NODE_ENV is development', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'development',
        CORS_ORIGINS: '*',
      });
      expect(result.success).toBe(true);
    });

    it('should reject wildcard * when NODE_ENV is production', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGINS: '*',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Wildcard origin (*) is not allowed in production',
        );
      }
    });

    it('should reject CORS_ORIGINS containing wildcard * among other origins in production', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://example.com, *',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid explicit origins in production', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://example.com, https://app.example.com',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('configureCors', () => {
    let mockApp: Partial<NestFastifyApplication>;
    let mockConfigService: Partial<ConfigService>;
    let enableCorsSpy: jest.Mock;

    beforeEach(() => {
      enableCorsSpy = jest.fn();
      mockApp = {
        enableCors: enableCorsSpy,
      };
    });

    it('should pass origin array and credentials true to enableCors', () => {
      mockConfigService = {
        get: jest
          .fn()
          .mockReturnValue('http://localhost:5173, https://admin.example.com'),
      };

      configureCors(
        mockApp as NestFastifyApplication,
        mockConfigService as ConfigService,
      );

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: ['http://localhost:5173', 'https://admin.example.com'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      });
    });

    it('should handle wildcard * as string', () => {
      mockConfigService = {
        get: jest.fn().mockReturnValue('*'),
      };

      configureCors(
        mockApp as NestFastifyApplication,
        mockConfigService as ConfigService,
      );

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      });
    });

    it('should handle origin as an array directly', () => {
      mockConfigService = {
        get: jest.fn().mockReturnValue(['http://localhost:5173']),
      };

      configureCors(
        mockApp as NestFastifyApplication,
        mockConfigService as ConfigService,
      );

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: ['http://localhost:5173'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      });
    });

    it('should handle undefined or null corsOrigins and default to empty array', () => {
      mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      configureCors(
        mockApp as NestFastifyApplication,
        mockConfigService as ConfigService,
      );

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: [],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      });
    });

    it('should trim and filter empty elements from comma-separated string', () => {
      mockConfigService = {
        get: jest
          .fn()
          .mockReturnValue(
            ' http://localhost:5173 , , https://app.example.com ',
          ),
      };

      configureCors(
        mockApp as NestFastifyApplication,
        mockConfigService as ConfigService,
      );

      expect(enableCorsSpy).toHaveBeenCalledWith({
        origin: ['http://localhost:5173', 'https://app.example.com'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      });
    });

    it('should hard-fail in production when corsOrigins is wildcard *', () => {
      mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          if (key === 'app.corsOrigins') return '*';
          return undefined;
        }),
      };

      expect(() =>
        configureCors(
          mockApp as NestFastifyApplication,
          mockConfigService as ConfigService,
        ),
      ).toThrow('Wildcard origin (*) is not allowed in production');
    });

    it('should hard-fail in production when corsOrigins array contains wildcard *', () => {
      mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          if (key === 'app.corsOrigins') {
            return ['https://example.com', '*'];
          }
          return undefined;
        }),
      };

      expect(() =>
        configureCors(
          mockApp as NestFastifyApplication,
          mockConfigService as ConfigService,
        ),
      ).toThrow('Wildcard origin (*) is not allowed in production');
    });
  });
});
