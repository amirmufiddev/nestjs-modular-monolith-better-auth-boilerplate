// Mock decorators before importing
jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => jest.fn(),
  MemberHasPermission: () => jest.fn(),
  OrgRoles: () => jest.fn(),
  AuthService: class {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { DECORATORS } from '@nestjs/swagger';
import { PermissionsController } from './permissions.controller';
import { PermissionScopeService } from '../services/permission-scope.service';
import { PermissionScopeCacheService } from '../services/permission-scope-cache.service';
import { RbacPermissionService } from '../services/rbac-permission.service';
import { getAllPermissionCodes } from '../constants/permissions.constant';
import { PermissionCodesResponseDto } from '../dto/permission.dto';
import { SCOPE_META_KEY } from '../decorators/require-permission.decorator';

function getApiResponseType(
  handler: (...args: unknown[]) => unknown,
  status: number,
) {
  const metadata = Reflect.getMetadata(DECORATORS.API_RESPONSE, handler);
  return metadata?.[status]?.type;
}

const mockCatalog = {
  resources: [
    {
      resource: 'member',
      displayName: 'Anggota',
      actions: { read: { displayName: 'Lihat Anggota' } },
    },
  ],
  permissions: [
    {
      code: 'member:read',
      resource: 'member',
      action: 'read',
      displayName: 'Lihat Anggota',
    },
  ],
};

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let reflector: Reflector;
  let rbacPermissionService: {
    getCatalog: jest.Mock;
    getPermissionCodes: jest.Mock;
  };

  beforeEach(async () => {
    reflector = new Reflector();
    rbacPermissionService = {
      getCatalog: jest.fn().mockResolvedValue(mockCatalog),
      getPermissionCodes: jest.fn().mockResolvedValue(getAllPermissionCodes()),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: Reflector,
          useValue: reflector,
        },
        {
          provide: RbacPermissionService,
          useValue: rbacPermissionService,
        },
        {
          provide: PermissionScopeService,
          useValue: {
            resolveScope: jest.fn(),
            createUserScope: jest.fn(),
            createSystemScope: jest.fn(),
          },
        },
        {
          provide: PermissionScopeCacheService,
          useValue: {
            resolveScope: jest.fn(),
            createUserScope: jest.fn(),
            createSystemScope: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PermissionsController>(PermissionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Security & Decorator rules', () => {
    it('should be protected with @RequirePermission("ac:read")', () => {
      const getPermissionsMetadata = Reflect.getMetadata(
        SCOPE_META_KEY,
        controller.getPermissions,
      );
      const getPermissionCodesMetadata = Reflect.getMetadata(
        SCOPE_META_KEY,
        controller.getPermissionCodes,
      );

      expect(getPermissionsMetadata).toEqual({
        resource: 'ac',
        action: 'read',
      });
      expect(getPermissionCodesMetadata).toEqual({
        resource: 'ac',
        action: 'read',
      });
    });

    it('should not have @AllowAnonymous decorator on endpoints', () => {
      const getPermissionsAllowAnon = Reflect.getMetadata(
        'ALLOW_ANONYMOUS',
        controller.getPermissions,
      );
      const getPermissionCodesAllowAnon = Reflect.getMetadata(
        'ALLOW_ANONYMOUS',
        controller.getPermissionCodes,
      );

      expect(getPermissionsAllowAnon).toBeUndefined();
      expect(getPermissionCodesAllowAnon).toBeUndefined();
    });
  });

  describe('getPermissions', () => {
    it('should return catalog from service', async () => {
      const result = await controller.getPermissions();

      expect(rbacPermissionService.getCatalog).toHaveBeenCalled();
      expect(result.permissions[0].code).toBe('member:read');
    });
  });

  describe('getPermissionCodes', () => {
    it('should return flat array of permission codes', async () => {
      const result = await controller.getPermissionCodes();

      expect(result.codes).toContain('member:read');
      expect(result.codes).toContain('broadcast:trigger');
    });

    it('should document response as PermissionCodesResponseDto', () => {
      expect(getApiResponseType(controller.getPermissionCodes, 200)).toBe(
        PermissionCodesResponseDto,
      );
    });
  });
});
