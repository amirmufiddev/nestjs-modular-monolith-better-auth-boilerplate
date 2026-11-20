import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessError } from '@/common/errors/business-error';
import { RbacPermissionService } from './rbac-permission.service';
import {
  RBAC_PERMISSION_REPOSITORY_TOKEN,
  type IRbacPermissionRepository,
} from '../interfaces/rbac-permission-repository.interface';
import type { RbacPermission } from '@/database/schema';

describe('RbacPermissionService', () => {
  let service: RbacPermissionService;
  let repo: IRbacPermissionRepository;

  const mockPermission: RbacPermission = {
    id: 'perm-1',
    resource: 'user',
    action: 'create',
    actionDisplayName: 'Create User',
    actionDescription: 'Allows creating users',
    resourceDisplayName: 'User Management',
    resourceDescription: 'Managing users',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    repo = {
      findAllActive: mock(() => Promise.resolve([mockPermission])),
      findByResourceAndAction: mock(() => Promise.resolve(undefined)),
      findActiveById: mock(() => Promise.resolve(mockPermission)),
      createPermission: mock((data) =>
        Promise.resolve({
          ...mockPermission,
          ...data,
        } as RbacPermission),
      ),
      updatePermission: mock((_id, data) =>
        Promise.resolve({
          ...mockPermission,
          ...data,
        } as RbacPermission),
      ),
      softDelete: mock(() => Promise.resolve(true)),
    };

    const module = await Test.createTestingModule({
      providers: [
        RbacPermissionService,
        {
          provide: RBAC_PERMISSION_REPOSITORY_TOKEN,
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<RbacPermissionService>(RbacPermissionService);
  });

  describe('getCatalog', () => {
    it('should retrieve active permissions and return catalog view', async () => {
      const catalog = await service.getCatalog();
      expect(repo.findAllActive).toHaveBeenCalled();
      expect(Array.isArray(catalog.resources)).toBe(true);
      expect(catalog.resources.length).toBe(1);
      expect(catalog.resources[0].resource).toBe('user');
      expect(catalog.permissions.length).toBe(1);
      expect(catalog.permissions[0].code).toBe('user:create');
    });
  });

  describe('getPermissionCodes', () => {
    it('should retrieve active permissions and return sorted codes', async () => {
      const codes = await service.getPermissionCodes();
      expect(repo.findAllActive).toHaveBeenCalled();
      expect(codes).toEqual(['user:create']);
    });
  });

  describe('getById', () => {
    it('should return permission if found', async () => {
      const result = await service.getById('perm-1');
      expect(repo.findActiveById).toHaveBeenCalledWith('perm-1');
      expect(result).toEqual(mockPermission);
    });

    it('should throw notFound BusinessError if not found', async () => {
      (repo.findActiveById as any).mockResolvedValueOnce(undefined);
      await expect(service.getById('nonexistent')).rejects.toThrow(
        BusinessError,
      );
    });
  });

  describe('create', () => {
    it('should throw unprocessable error on invalid slug format', async () => {
      await expect(
        service.create({
          resource: 'INVALID RESOURCE',
          action: 'read',
          actionDisplayName: 'Read',
          resourceDisplayName: 'Resource',
        }),
      ).rejects.toThrow(BusinessError);
    });

    it('should throw conflict error if resource:action already exists', async () => {
      (repo.findByResourceAndAction as any).mockResolvedValueOnce(
        mockPermission,
      );

      await expect(
        service.create({
          resource: 'user',
          action: 'create',
          actionDisplayName: 'Create',
          resourceDisplayName: 'User',
        }),
      ).rejects.toThrow(BusinessError);
    });

    it('should create new permission when valid', async () => {
      const result = await service.create({
        resource: 'role',
        action: 'read',
        actionDisplayName: 'Read Role',
        resourceDisplayName: 'Role',
      });

      expect(repo.createPermission).toHaveBeenCalled();
      expect(result.resource).toBe('role');
      expect(result.action).toBe('read');
    });
  });

  describe('update', () => {
    it('should update permission details', async () => {
      const result = await service.update('perm-1', {
        actionDisplayName: 'New Action Name',
      });

      expect(repo.updatePermission).toHaveBeenCalledWith('perm-1', {
        actionDisplayName: 'New Action Name',
        actionDescription: undefined,
        resourceDisplayName: undefined,
        resourceDescription: undefined,
      });
      expect(result.actionDisplayName).toBe('New Action Name');
    });

    it('should throw notFound if update returns undefined', async () => {
      (repo.updatePermission as any).mockResolvedValueOnce(undefined);

      await expect(
        service.update('perm-1', {
          actionDisplayName: 'Updated',
        }),
      ).rejects.toThrow(BusinessError);
    });
  });

  describe('remove', () => {
    it('should soft delete permission', async () => {
      await service.remove('perm-1');
      expect(repo.softDelete).toHaveBeenCalledWith('perm-1');
    });

    it('should throw notFound if soft delete returns false', async () => {
      (repo.softDelete as any).mockResolvedValueOnce(false);
      await expect(service.remove('perm-1')).rejects.toThrow(BusinessError);
    });
  });
});
