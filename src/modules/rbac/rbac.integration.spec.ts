import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { PermissionScopeService } from './services/permission-scope.service';
import { PermissionScopeInterceptor } from './interceptors/permission-scope.interceptor';
import {
  RequirePermission,
  SCOPE_META_KEY,
} from './decorators/require-permission.decorator';

describe('RBAC Comprehensive Integration Test Suite', () => {
  let scopeService: PermissionScopeService;
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      api: {
        getFullOrganization: mock(),
        getOrgRole: mock(),
      },
    };
    scopeService = new PermissionScopeService(mockAuthService);
  });

  describe('1. Scope Resolution Scenarios (PermissionScopeService)', () => {
    it('should resolve GLOBAL scope for System Admin (superadmin)', async () => {
      const result = await scopeService.resolveScope({
        userId: 'user_admin_1',
        userRole: 'superadmin',
        activeOrgId: 'org_123',
        resource: 'transaction',
        action: 'read',
      });

      expect(result).toEqual({
        type: 'global',
        userId: 'user_admin_1',
        activeOrgId: 'org_123',
      });
      expect(mockAuthService.api.getFullOrganization).not.toHaveBeenCalled();
    });

    it('should resolve ORGANIZATION scope for Owner Role', async () => {
      mockAuthService.api.getFullOrganization.mockResolvedValue({
        id: 'org_123',
        members: [{ userId: 'user_owner_1', role: 'owner' }],
      });
      mockAuthService.api.getOrgRole.mockResolvedValue({
        role: 'owner',
        permissionScopes: JSON.stringify({
          'transaction:read': 'organization',
        }),
      });

      const result = await scopeService.resolveScope({
        userId: 'user_owner_1',
        userRole: 'user',
        activeOrgId: 'org_123',
        resource: 'transaction',
        action: 'read',
      });

      expect(result).toEqual({
        type: 'organization',
        userId: 'user_owner_1',
        orgId: 'org_123',
        activeOrgId: 'org_123',
      });
    });

    it('should resolve OUTLET scope for Admin Outlet Role', async () => {
      mockAuthService.api.getFullOrganization.mockResolvedValue({
        id: 'org_123',
        members: [{ userId: 'user_outlet_admin', role: 'admin_outlet' }],
      });
      mockAuthService.api.getOrgRole.mockResolvedValue({
        role: 'admin_outlet',
        permissionScopes: JSON.stringify({ 'transaction:read': 'outlet' }),
      });

      const result = await scopeService.resolveScope({
        userId: 'user_outlet_admin',
        userRole: 'user',
        activeOrgId: 'org_123',
        resource: 'transaction',
        action: 'read',
      });

      expect(result).toEqual({
        type: 'outlet',
        userId: 'user_outlet_admin',
        orgId: 'org_123',
        activeOrgId: 'org_123',
      });
    });

    it('should resolve OWN scope for Customer / regular Member', async () => {
      mockAuthService.api.getFullOrganization.mockResolvedValue({
        id: 'org_123',
        members: [{ userId: 'user_customer_1', role: 'customer' }],
      });
      mockAuthService.api.getOrgRole.mockResolvedValue({
        role: 'customer',
        permissionScopes: JSON.stringify({ 'transaction:read': 'own' }),
      });

      const result = await scopeService.resolveScope({
        userId: 'user_customer_1',
        userRole: 'user',
        activeOrgId: 'org_123',
        resource: 'transaction',
        action: 'read',
      });

      expect(result).toEqual({
        type: 'own',
        userId: 'user_customer_1',
        orgId: 'org_123',
        activeOrgId: 'org_123',
      });
    });

    it('should fallback to OWN scope when no Active Organization ID is provided', async () => {
      const result = await scopeService.resolveScope({
        userId: 'user_no_org',
        userRole: 'user',
        activeOrgId: undefined,
        resource: 'transaction',
        action: 'read',
      });

      expect(result).toEqual({
        type: 'own',
        userId: 'user_no_org',
      });
    });
  });

  describe('2. Interceptor Lifecycle & Context Attachment (PermissionScopeInterceptor)', () => {
    let interceptor: PermissionScopeInterceptor;
    let mockReflector: any;

    beforeEach(() => {
      mockReflector = {
        get: mock(),
      };
      interceptor = new PermissionScopeInterceptor(mockReflector, scopeService);
    });

    it('should attach default OWN scope when endpoint has no RBAC metadata', async () => {
      mockReflector.get.mockReturnValue(undefined);

      const request: any = {
        session: { user: { id: 'user_123', role: 'user' } },
      };
      const executionContext: any = {
        getHandler: () => ({}),
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      };

      const next: any = { handle: mock().mockReturnValue('next_stream') };

      await interceptor.intercept(executionContext, next);

      expect(request.permissionScope).toEqual({
        type: 'own',
        userId: 'user_123',
      });
      expect(next.handle).toHaveBeenCalled();
    });

    it('should resolve dynamic scope and attach it to request when metadata is available', async () => {
      mockReflector.get.mockReturnValue({
        resource: 'member',
        action: 'read',
      });

      mockAuthService.api.getFullOrganization.mockResolvedValue({
        id: 'org_999',
        members: [{ userId: 'user_456', role: 'owner' }],
      });
      mockAuthService.api.getOrgRole.mockResolvedValue({
        role: 'owner',
        permissionScopes: { 'member:read': 'organization' },
      });

      const request: any = {
        session: {
          user: { id: 'user_456', role: 'user' },
          session: { activeOrganizationId: 'org_999' },
        },
      };
      const executionContext: any = {
        getHandler: () => ({}),
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      };

      const next: any = { handle: mock().mockReturnValue('next_stream') };

      await interceptor.intercept(executionContext, next);

      expect(request.permissionScope).toEqual({
        type: 'organization',
        userId: 'user_456',
        orgId: 'org_999',
        activeOrgId: 'org_999',
      });
    });
  });

  describe('3. Decorator Validation & Metadata Binding (RequirePermission)', () => {
    it('should throw error if permission string format is invalid', () => {
      expect(() => RequirePermission('invalid_format')).toThrow(
        'Invalid permission format: "invalid_format". Expected "resource:action"',
      );
    });

    it('should build valid metadata for "resource:action" permission format', () => {
      class TestController {
        @RequirePermission('member:update')
        createProduct() {}
      }

      const metadata = Reflect.getMetadata(
        SCOPE_META_KEY,
        TestController.prototype.createProduct,
      );

      expect(metadata).toEqual({
        resource: 'member',
        action: 'update',
      });
    });
  });
});
