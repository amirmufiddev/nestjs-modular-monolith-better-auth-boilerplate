import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { PermissionScopeService } from './permission-scope.service';
import { ResolveParams } from '../types/permission-scope.types';

describe('PermissionScopeService', () => {
  let service: PermissionScopeService;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {
      api: {
        getFullOrganization: jest.fn(),
        getOrgRole: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionScopeService,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<PermissionScopeService>(PermissionScopeService);
  });

  describe('createSystemScope', () => {
    it('should return global scope with userId SYSTEM', () => {
      const result = service.createSystemScope();
      expect(result).toEqual({
        type: 'global',
        userId: 'SYSTEM',
      });
    });
  });

  describe('resolveScope', () => {
    it('should return global scope for system admin user (superadmin)', async () => {
      const params: ResolveParams = {
        userId: 'user-1',
        userRole: 'superadmin',
        activeOrgId: 'org-1',
        resource: 'transaction',
        action: 'read',
      };

      const result = await service.resolveScope(params);

      expect(result).toEqual({
        type: 'global',
        userId: 'user-1',
        activeOrgId: 'org-1',
      });
      expect(mockAuthService.api.getFullOrganization).not.toHaveBeenCalled();
    });

    it('should return global scope for system admin user (admin array)', async () => {
      const params: ResolveParams = {
        userId: 'user-1',
        userRole: ['user', 'admin'],
        activeOrgId: 'org-1',
        resource: 'transaction',
        action: 'read',
      };

      const result = await service.resolveScope(params);

      expect(result).toEqual({
        type: 'global',
        userId: 'user-1',
        activeOrgId: 'org-1',
      });
    });

    it('should return own scope when activeOrgId is not provided', async () => {
      const params: ResolveParams = {
        userId: 'user-1',
        userRole: 'user',
        resource: 'transaction',
        action: 'read',
      };

      const result = await service.resolveScope(params);

      expect(result).toEqual({
        type: 'own',
        userId: 'user-1',
      });
      expect(mockAuthService.api.getFullOrganization).not.toHaveBeenCalled();
    });

    it('should return resolved scope from org role permissionScopes', async () => {
      const params: ResolveParams = {
        userId: 'user-1',
        userRole: 'user',
        activeOrgId: 'org-1',
        resource: 'transaction',
        action: 'read',
      };

      mockAuthService.api.getFullOrganization.mockResolvedValue({
        members: [{ userId: 'user-1', role: 'manager' }],
      });

      mockAuthService.api.getOrgRole.mockResolvedValue({
        role: 'manager',
        permissionScopes: JSON.stringify({
          'transaction:read': 'organization',
        }),
      });

      const result = await service.resolveScope(params);

      expect(mockAuthService.api.getFullOrganization).toHaveBeenCalledWith({
        query: { organizationId: 'org-1' },
      });
      expect(mockAuthService.api.getOrgRole).toHaveBeenCalledWith({
        query: { roleName: 'manager', organizationId: 'org-1' },
      });
      expect(result).toEqual({
        type: 'organization',
        userId: 'user-1',
        orgId: 'org-1',
        activeOrgId: 'org-1',
      });
    });

    it('should fallback to own scope if user is not in org members or API throws', async () => {
      const params: ResolveParams = {
        userId: 'user-1',
        userRole: 'user',
        activeOrgId: 'org-1',
        resource: 'transaction',
        action: 'read',
      };

      mockAuthService.api.getFullOrganization.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await service.resolveScope(params);

      expect(result).toEqual({
        type: 'own',
        userId: 'user-1',
        activeOrgId: 'org-1',
      });
    });
  });

  describe('createUserScope', () => {
    it('should return own scope if orgId, resource or action missing', async () => {
      const result = await service.createUserScope('user-1');
      expect(result).toEqual({
        type: 'own',
        userId: 'user-1',
      });
    });

    it('should call resolveScope when full details provided', async () => {
      mockAuthService.api.getFullOrganization.mockResolvedValue({
        members: [{ userId: 'user-1', role: 'owner' }],
      });

      mockAuthService.api.getOrgRole.mockResolvedValue({
        role: 'owner',
        permissionScopes: {
          'transaction:create': 'organization',
        },
      });

      const result = await service.createUserScope(
        'user-1',
        'org-1',
        'transaction',
        'create',
      );

      expect(result).toEqual({
        type: 'organization',
        userId: 'user-1',
        orgId: 'org-1',
        activeOrgId: 'org-1',
      });
    });
  });
});
