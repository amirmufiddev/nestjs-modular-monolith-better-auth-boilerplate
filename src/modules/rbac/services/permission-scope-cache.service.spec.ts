import { Test } from '@nestjs/testing';
import { PermissionScopeCacheService } from './permission-scope-cache.service';
import { PermissionScopeService } from './permission-scope.service';
import { CacheService } from '@/common/cache/cache.service';
import {
  PermissionScopeContext,
  ResolveParams,
} from '../types/permission-scope.types';

describe('PermissionScopeCacheService', () => {
  let service: PermissionScopeCacheService;
  let mockCacheService: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    delMany: jest.Mock;
  };
  let mockScopeService: { resolveScope: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delMany: jest.fn(),
    };
    mockScopeService = {
      resolveScope: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PermissionScopeCacheService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: PermissionScopeService,
          useValue: mockScopeService,
        },
      ],
    }).compile();

    service = module.get(PermissionScopeCacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveScope', () => {
    const params: ResolveParams = {
      userId: 'user-1',
      userRole: 'admin',
      activeOrgId: 'org-1',
      resource: 'order',
      action: 'read',
    };

    const expectedContext: PermissionScopeContext = {
      type: 'global',
      userId: 'user-1',
      activeOrgId: 'org-1',
    };

    it('should return cached value on cache HIT without calling underlying scopeService', async () => {
      mockCacheService.get.mockResolvedValueOnce(expectedContext);

      const result = await service.resolveScope(params);

      expect(result).toEqual(expectedContext);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        'rbac:scope:org:org-1:user:user-1:resource:order:action:read',
      );
      expect(mockScopeService.resolveScope).not.toHaveBeenCalled();
    });

    it('should call scopeService and cache result on cache MISS', async () => {
      mockCacheService.get.mockResolvedValueOnce(undefined);
      mockScopeService.resolveScope.mockResolvedValueOnce(expectedContext);

      const result = await service.resolveScope(params);

      expect(result).toEqual(expectedContext);
      expect(mockScopeService.resolveScope).toHaveBeenCalledWith(params);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'rbac:scope:org:org-1:user:user-1:resource:order:action:read',
        expectedContext,
      );
    });

    it('should fallback to scopeService if cache get throws error', async () => {
      mockCacheService.get.mockRejectedValueOnce(
        new Error('Redis connection failed'),
      );
      mockScopeService.resolveScope.mockResolvedValueOnce(expectedContext);

      const result = await service.resolveScope(params);

      expect(result).toEqual(expectedContext);
      expect(mockScopeService.resolveScope).toHaveBeenCalledWith(params);
    });

    it('should return scope result even if cache set throws error', async () => {
      mockCacheService.get.mockResolvedValueOnce(undefined);
      mockScopeService.resolveScope.mockResolvedValueOnce(expectedContext);
      mockCacheService.set.mockRejectedValueOnce(new Error('Redis set failed'));

      const result = await service.resolveScope(params);

      expect(result).toEqual(expectedContext);
    });
  });

  describe('handleInvalidateEvent', () => {
    it('should invalidate cache when event has orgId', async () => {
      await service.handleInvalidateEvent({ orgId: 'org-123' });

      // Clean invalidation trigger
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should ignore invalid event without orgId', async () => {
      await service.handleInvalidateEvent({});

      expect(mockCacheService.del).not.toHaveBeenCalled();
    });
  });
});
