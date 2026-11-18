import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import fastifyRateLimit from '@fastify/rate-limit';
import { configureRateLimit } from './rate-limit.config';
import * as pluginRegisterUtil from './plugin-register.util';

describe('configureRateLimit', () => {
  let registerSpy: jest.SpyInstance;
  let mockApp: NestFastifyApplication;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    registerSpy = jest
      .spyOn(pluginRegisterUtil, 'registerFastifyPlugin')
      .mockResolvedValue(undefined);
    mockApp = {} as NestFastifyApplication;
  });

  afterEach(() => {
    registerSpy.mockRestore();
  });

  it('should register fastifyRateLimit plugin with default options when config values are not set', async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'rateLimit.enabled') return undefined;
        if (key === 'rateLimit.max') return undefined;
        if (key === 'rateLimit.timeWindow') return undefined;
        return undefined;
      }),
    };

    await configureRateLimit(mockApp, mockConfigService as ConfigService);

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(mockApp, fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });
  });

  it('should register fastifyRateLimit plugin with custom config options', async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'rateLimit.enabled') return true;
        if (key === 'rateLimit.max') return 50;
        if (key === 'rateLimit.timeWindow') return '10 minutes';
        return undefined;
      }),
    };

    await configureRateLimit(mockApp, mockConfigService as ConfigService);

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(mockApp, fastifyRateLimit, {
      max: 50,
      timeWindow: '10 minutes',
    });
  });

  it('should skip plugin registration when rateLimit.enabled is false', async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'rateLimit.enabled') return false;
        return undefined;
      }),
    };

    await configureRateLimit(mockApp, mockConfigService as ConfigService);

    expect(registerSpy).not.toHaveBeenCalled();
  });
});
