import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { BusinessError } from '@/common/errors/business-error';
import { OrganizationRoleService } from './organization-role.service';
import {
  ORGANIZATION_ROLE_REPOSITORY_TOKEN,
  type IOrganizationRoleRepository,
} from '../interfaces/organization-role-repository.interface';
import type { OrganizationRole } from '@/database/schema';

describe('OrganizationRoleService', () => {
  let service: OrganizationRoleService;
  let repo: IOrganizationRoleRepository;
  let authService: { api: any };
  let eventEmitter: { emit: ReturnType<typeof mock> };

  const mockRole: OrganizationRole = {
    id: 'role-1',
    organizationId: 'org-1',
    role: 'manager',
    permission: { 'user:read': ['read'] },
    permissionScopes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repo = {
      findByOrganization: mock(() => Promise.resolve([mockRole])),
      findByOrganizationAndRoleName: mock(() => Promise.resolve(mockRole)),
      findById: mock(() => Promise.resolve(mockRole)),
    };

    authService = {
      api: {
        createOrgRole: mock(() =>
          Promise.resolve({
            roleData: {
              id: 'role-1',
              role: 'manager',
              organizationId: 'org-1',
              permission: {},
            },
          }),
        ),
        updateOrgRole: mock(() =>
          Promise.resolve({
            id: 'role-1',
            role: 'manager',
            organizationId: 'org-1',
            permission: {},
          }),
        ),
        deleteOrgRole: mock(() => Promise.resolve()),
      },
    };

    eventEmitter = {
      emit: mock(),
    };

    const module = await Test.createTestingModule({
      providers: [
        OrganizationRoleService,
        {
          provide: ORGANIZATION_ROLE_REPOSITORY_TOKEN,
          useValue: repo,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<OrganizationRoleService>(OrganizationRoleService);
  });

  describe('list', () => {
    it('should delegate to repository.findByOrganization', async () => {
      const result = await service.list('org-1');
      expect(repo.findByOrganization).toHaveBeenCalledWith('org-1');
      expect(result).toEqual([mockRole]);
    });
  });

  describe('getById', () => {
    it('should return role when found', async () => {
      const result = await service.getById('org-1', 'role-1');
      expect(repo.findById).toHaveBeenCalledWith('org-1', 'role-1');
      expect(result).toEqual(mockRole);
    });

    it('should throw notFound BusinessError when not found', async () => {
      (repo.findById as any).mockResolvedValueOnce(undefined);
      await expect(service.getById('org-1', 'non-existent')).rejects.toThrow(
        BusinessError,
      );
    });
  });

  describe('create', () => {
    it('should throw unprocessable error for owner or empty role name', async () => {
      await expect(
        service.create('org-1', { role: 'owner', permission: {} }),
      ).rejects.toThrow(BusinessError);

      await expect(
        service.create('org-1', { role: '   ', permission: {} }),
      ).rejects.toThrow(BusinessError);
    });

    it('should create role, emit cache invalidation event, and return roleData', async () => {
      const result = await service.create('org-1', {
        role: 'editor',
        permission: { 'user:read': ['read'] },
      });

      expect(authService.api.createOrgRole).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('rbac.cache.invalidate', {
        orgId: 'org-1',
      });
      expect(result.id).toBe('role-1');
    });
  });

  describe('update', () => {
    it('should throw forbidden BusinessError if existing role is owner', async () => {
      (repo.findById as any).mockResolvedValueOnce({
        ...mockRole,
        role: 'owner',
      });

      await expect(
        service.update('org-1', 'role-1', { role: 'owner', permission: {} }),
      ).rejects.toThrow(BusinessError);
    });

    it('should update role, emit cache invalidation, and return updated data', async () => {
      const result = await service.update('org-1', 'role-1', {
        role: 'supervisor',
        permission: {},
      });

      expect(authService.api.updateOrgRole).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('rbac.cache.invalidate', {
        orgId: 'org-1',
      });
      expect(result.id).toBe('role-1');
    });
  });

  describe('remove', () => {
    it('should throw forbidden if deleting owner role', async () => {
      (repo.findById as any).mockResolvedValueOnce({
        ...mockRole,
        role: 'owner',
      });

      await expect(service.remove('org-1', 'role-1')).rejects.toThrow(
        BusinessError,
      );
    });

    it('should call deleteOrgRole and emit cache invalidation', async () => {
      await service.remove('org-1', 'role-1');
      expect(authService.api.deleteOrgRole).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('rbac.cache.invalidate', {
        orgId: 'org-1',
      });
    });
  });

  describe('assertAssignableRole', () => {
    it('should throw forbidden if role is owner', async () => {
      await expect(
        service.assertAssignableRole('org-1', 'owner'),
      ).rejects.toThrow(BusinessError);
    });

    it('should throw unprocessable if role not found in organization', async () => {
      (repo.findByOrganizationAndRoleName as any).mockResolvedValueOnce(
        undefined,
      );
      await expect(
        service.assertAssignableRole('org-1', 'nonexistent'),
      ).rejects.toThrow(BusinessError);
    });

    it('should succeed if role exists', async () => {
      await expect(
        service.assertAssignableRole('org-1', 'manager'),
      ).resolves.toBeUndefined();
    });
  });
});
