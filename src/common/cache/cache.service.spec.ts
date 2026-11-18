import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { AppLoggerService } from '@/logger/logger.service';
import { RlsContext } from '@/shared/database/rls-context';

describe('CacheService', () => {
  let service: CacheService;
  let mockCacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  let mockLogger: { warn: jest.Mock; log: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    mockLogger = {
      warn: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: AppLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get(CacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('get', () => {
    it('should return value from cacheManager.get when successful', async () => {
      mockCacheManager.get.mockResolvedValueOnce('bar');
      const result = await service.get('foo');
      expect(result).toBe('bar');
      expect(mockCacheManager.get).toHaveBeenCalledWith('foo');
    });

    it('should return undefined when Redis throws', async () => {
      mockCacheManager.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await service.get('foo');
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache get failed'),
        'CacheService',
      );
    });
  });

  describe('set', () => {
    it('should call cacheManager.set when successful', async () => {
      mockCacheManager.set.mockResolvedValueOnce(undefined);
      await service.set('foo', 'bar', 1000);
      expect(mockCacheManager.set).toHaveBeenCalledWith('foo', 'bar', 1000);
    });

    it('should not throw when Redis throws', async () => {
      mockCacheManager.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.set('foo', 'bar')).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache set failed'),
        'CacheService',
      );
    });
  });

  describe('del', () => {
    it('should call cacheManager.del when successful', async () => {
      mockCacheManager.del.mockResolvedValueOnce(undefined);
      await service.del('foo');
      expect(mockCacheManager.del).toHaveBeenCalledWith('foo');
    });

    it('should not throw when Redis throws', async () => {
      mockCacheManager.del.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.del('foo')).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache del failed'),
        'CacheService',
      );
    });
  });

  describe('delMany', () => {
    it('should call del for each key provided', async () => {
      mockCacheManager.del.mockResolvedValue(undefined);
      await service.delMany(['k1', 'k2']);
      expect(mockCacheManager.del).toHaveBeenCalledWith('k1');
      expect(mockCacheManager.del).toHaveBeenCalledWith('k2');
    });

    it('should do nothing if keys array is empty', async () => {
      await service.delMany([]);
      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value when present without calling factory', async () => {
      mockCacheManager.get.mockResolvedValueOnce('cached-value');
      const factory = jest.fn();
      const result = await service.getOrSet('foo', factory);
      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result when missing', async () => {
      mockCacheManager.get.mockResolvedValueOnce(undefined);
      mockCacheManager.set.mockResolvedValueOnce(undefined);
      const factory = jest.fn().mockResolvedValue('new-value');
      const result = await service.getOrSet('foo', factory, 5000);
      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'foo',
        'new-value',
        5000,
      );
    });
  });

  describe('buildKey', () => {
    it('should include tenantId when RlsContext has organizationId', () => {
      jest
        .spyOn(RlsContext, 'getCurrentOrganizationId')
        .mockReturnValue('tenant-123');
      const key = service.buildKey('user:role:abc', 'app');
      expect(key).toBe('app:tenant-123:user:role:abc');
    });

    it('should omit tenantId when RlsContext organizationId is null', () => {
      jest.spyOn(RlsContext, 'getCurrentOrganizationId').mockReturnValue(null);
      const key = service.buildKey('user:role:abc', 'app');
      expect(key).toBe('app:user:role:abc');
    });
  });

  describe('setScoped', () => {
    it('should set key with explicit tenantId prefix', async () => {
      mockCacheManager.set.mockResolvedValueOnce(undefined);
      await service.setScoped(
        'tenant-999',
        'user:role:xyz',
        'val',
        'app',
        3000,
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'app:tenant-999:user:role:xyz',
        'val',
        3000,
      );
    });
  });
});
