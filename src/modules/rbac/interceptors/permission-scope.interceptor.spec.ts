// Mock decorators before importing
jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => jest.fn(),
  MemberHasPermission: () => jest.fn(),
  OrgRoles: () => jest.fn(),
  AuthService: class {},
}));

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { PermissionScopeInterceptor } from './permission-scope.interceptor';
import { PermissionScopeService } from '../services/permission-scope.service';
import { SCOPE_META_KEY } from '../decorators/require-permission.decorator';

describe('PermissionScopeInterceptor', () => {
  let interceptor: PermissionScopeInterceptor;
  let reflector: jest.Mocked<Reflector>;
  let scopeService: jest.Mocked<PermissionScopeService>;

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
    } as any;
    scopeService = {
      resolveScope: jest.fn(),
    } as any;

    interceptor = new PermissionScopeInterceptor(reflector, scopeService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should set default own scope with anonymous userId when meta and session are missing', async () => {
    reflector.get.mockReturnValue(undefined);
    const mockRequest: any = {};
    const mockContext = {
      getHandler: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    await interceptor.intercept(mockContext, mockCallHandler);

    expect(reflector.get).toHaveBeenCalledWith(
      SCOPE_META_KEY,
      mockContext.getHandler(),
    );
    expect(mockRequest.permissionScope).toEqual({
      type: 'own',
      userId: 'anonymous',
    });
  });

  it('should set default own scope with user id when meta is missing but session exists', async () => {
    reflector.get.mockReturnValue(undefined);
    const mockRequest: any = {
      session: {
        user: { id: 'user-123' },
      },
    };
    const mockContext = {
      getHandler: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    await interceptor.intercept(mockContext, mockCallHandler);

    expect(mockRequest.permissionScope).toEqual({
      type: 'own',
      userId: 'user-123',
    });
  });

  it('should resolve scope and attach to request when meta and session.user are present', async () => {
    const meta = { resource: 'member', action: 'read' };
    reflector.get.mockReturnValue(meta);

    const mockRequest: any = {
      session: {
        user: { id: 'user-456', role: 'member' },
        session: { activeOrganizationId: 'org-789' },
      },
    };
    const mockContext = {
      getHandler: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const resolvedScope = {
      type: 'organization' as const,
      userId: 'user-456',
      orgId: 'org-789',
      activeOrgId: 'org-789',
    };
    scopeService.resolveScope.mockResolvedValue(resolvedScope);

    const mockCallHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    await interceptor.intercept(mockContext, mockCallHandler);

    expect(scopeService.resolveScope).toHaveBeenCalledWith({
      userId: 'user-456',
      userRole: 'member',
      activeOrgId: 'org-789',
      resource: 'member',
      action: 'read',
    });
    expect(mockRequest.permissionScope).toEqual(resolvedScope);
  });
});
