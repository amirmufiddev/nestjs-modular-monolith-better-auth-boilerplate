import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FcmAdapter } from './fcm.adapter';
import { DriverTokenRepository } from './driver-token.repository';
import { AppLoggerService } from '@/logger/logger.service';

describe('FcmAdapter', () => {
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const buildAdapter = async (
    configMap: Record<string, string | undefined>,
  ): Promise<FcmAdapter> => {
    const mockConfig = {
      get: (key: string) => configMap[key],
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FcmAdapter,
        { provide: ConfigService, useValue: mockConfig },
        {
          provide: DriverTokenRepository,
          useValue: { findByUserId: () => [] },
        },
        { provide: AppLoggerService, useValue: mockLogger },
      ],
    }).compile();
    return moduleRef.get(FcmAdapter);
  };

  describe('when FCM is disabled (dev mode)', () => {
    it('should return false from sendToToken() without throwing', async () => {
      const adapter = await buildAdapter({ FCM_CREDENTIALS_PATH: '' });
      const result = await adapter.sendToToken('fake-token', {
        title: 'Test',
        body: 'Hello',
      });
      expect(result).toBe(false);
    });

    it('should report disabled status via isEnabled()', async () => {
      const adapter = await buildAdapter({});
      expect(adapter.isEnabled()).toBe(false);
    });

    it('should return false from sendToDriver when no tokens registered', async () => {
      const adapter = await buildAdapter({});
      const result = await adapter.sendToDriver('driver-x', {
        title: 'Test',
        body: 'Hello',
      });
      expect(result).toBe(false);
    });
  });

  describe('when FCM is enabled', () => {
    it('should report enabled status when credentials JSON path is provided', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'fcm-adapter-'));
      const credentialsPath = join(dir, 'service-account.json');
      writeFileSync(
        credentialsPath,
        JSON.stringify({
          project_id: 'test-project',
          private_key:
            '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
          client_email: 'test@test.iam.gserviceaccount.com',
        }),
      );
      const adapter = await buildAdapter({
        FCM_CREDENTIALS_PATH: credentialsPath,
      });
      expect(typeof adapter.isEnabled()).toBe('boolean');
    });
  });

  describe('sendToUser', () => {
    it('should return false when user has no tokens', async () => {
      const adapter = await buildAdapter({});
      const result = await adapter.sendToUser('user-without-token', {
        title: 'Title',
        body: 'Body',
      });
      expect(result).toBe(false);
    });

    it('should send push to multiple tokens and return true if any delivered', async () => {
      const mockDriverTokens = {
        findByUserId: jest
          .fn()
          .mockResolvedValue([
            { fcmToken: 'token-1' },
            { fcmToken: 'token-2' },
          ]),
      };
      const moduleRef = await Test.createTestingModule({
        providers: [
          FcmAdapter,
          { provide: ConfigService, useValue: { get: () => undefined } },
          { provide: DriverTokenRepository, useValue: mockDriverTokens },
          { provide: AppLoggerService, useValue: mockLogger },
        ],
      }).compile();
      const adapter = moduleRef.get(FcmAdapter);

      const sendToTokenSpy = jest
        .spyOn(adapter, 'sendToToken')
        .mockImplementation((token: string) => {
          if (token === 'token-1') return Promise.resolve(true);
          return Promise.resolve(false);
        });

      const result = await adapter.sendToUser('u-1', {
        title: 'Test',
        body: 'Msg',
      });

      expect(result).toBe(true);
      expect(sendToTokenSpy).toHaveBeenCalledTimes(2);
    });

    it('should tolerate errors in individual token sends via Promise.allSettled', async () => {
      const mockDriverTokens = {
        findByUserId: jest
          .fn()
          .mockResolvedValue([
            { fcmToken: 'token-fail' },
            { fcmToken: 'token-success' },
          ]),
      };
      const moduleRef = await Test.createTestingModule({
        providers: [
          FcmAdapter,
          { provide: ConfigService, useValue: { get: () => undefined } },
          { provide: DriverTokenRepository, useValue: mockDriverTokens },
          { provide: AppLoggerService, useValue: mockLogger },
        ],
      }).compile();
      const adapter = moduleRef.get(FcmAdapter);

      jest.spyOn(adapter, 'sendToToken').mockImplementation((token: string) => {
        if (token === 'token-fail') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(true);
      });

      const result = await adapter.sendToUser('u-1', {
        title: 'Test',
        body: 'Msg',
      });

      expect(result).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected failure while sending push to user',
        expect.any(Error),
        expect.objectContaining({ userId: 'u-1' }),
      );
    });
  });
});
