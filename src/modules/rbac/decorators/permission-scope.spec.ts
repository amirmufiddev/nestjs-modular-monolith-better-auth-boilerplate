import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

jest.mock('@thallesp/nestjs-better-auth', () => ({
  MemberHasPermission: jest.fn().mockImplementation((options) => {
    return (target: any, propertyKey?: string, descriptor?: any) => {
      Reflect.defineMetadata(
        'member_has_permission_options',
        options,
        descriptor ? descriptor.value : target,
      );
    };
  }),
}));

import { PermissionScope } from './permission-scope.decorator';
import {
  RequirePermission,
  RequirePermissions,
  SCOPE_META_KEY,
} from './require-permission.decorator';

describe('RBAC Decorators', () => {
  describe('PermissionScope ParamDecorator', () => {
    function getParamDecoratorFactory() {
      class TestClass {
        testMethod(@PermissionScope() _scope: any) {}
      }

      const metadata = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        TestClass,
        'testMethod',
      );
      const key = Object.keys(metadata)[0];
      return metadata[key].factory;
    }

    it('should return request.permissionScope if present', () => {
      const factory = getParamDecoratorFactory();
      const mockScope = {
        type: 'organization',
        userId: 'user-123',
        orgId: 'org-1',
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            permissionScope: mockScope,
          }),
        }),
      } as unknown as ExecutionContext;

      const result = factory(null, mockContext);
      expect(result).toEqual(mockScope);
    });

    it('should return default scope if request.permissionScope is undefined', () => {
      const factory = getParamDecoratorFactory();

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            session: {
              user: { id: 'user-456' },
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const result = factory(null, mockContext);
      expect(result).toEqual({
        type: 'own',
        userId: 'user-456',
      });
    });
  });

  describe('RequirePermission MethodDecorator', () => {
    it('should throw error for invalid permission format', () => {
      expect(() => RequirePermission('invalid_format')).toThrow(
        'Invalid permission format: "invalid_format". Expected "resource:action"',
      );
      expect(() => RequirePermission('resource:')).toThrow(
        'Invalid permission format: "resource:". Expected "resource:action"',
      );
    });

    it('should attach correct SCOPE_META_KEY metadata', () => {
      class TestClass {
        @RequirePermission('transaction:read')
        handler() {}
      }

      const meta = Reflect.getMetadata(
        SCOPE_META_KEY,
        TestClass.prototype.handler,
      );
      expect(meta).toEqual({
        resource: 'transaction',
        action: 'read',
      });
    });
  });

  describe('RequirePermissions MethodDecorator', () => {
    it('should throw error if any permission in array has invalid format', () => {
      expect(() =>
        RequirePermissions(['transaction:read', 'invalid_perm']),
      ).toThrow(
        'Invalid permission format: "invalid_perm". Expected "resource:action"',
      );
    });

    it('should attach metadata from the first permission', () => {
      class TestClass {
        @RequirePermissions(['member:read', 'broadcast:trigger'])
        handler() {}
      }

      const meta = Reflect.getMetadata(
        SCOPE_META_KEY,
        TestClass.prototype.handler,
      );
      expect(meta).toEqual({
        resource: 'member',
        action: 'read',
      });
    });
  });
});
