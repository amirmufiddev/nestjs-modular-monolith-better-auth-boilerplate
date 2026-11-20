import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { RbacModule } from './rbac.module';
import { PermissionScopeService } from './services/permission-scope.service';
import { PermissionScopeCacheService } from './services/permission-scope-cache.service';
import { AuditTrailService } from './services/audit-trail.service';
import { AuditTrailRepository } from './repositories/audit-trail.repository';
import { PermissionScopeInterceptor } from './interceptors/permission-scope.interceptor';
import { PermissionsController } from './controllers/permissions.controller';
import { OrganizationRoleService } from './services/organization-role.service';
import { RbacPermissionService } from './services/rbac-permission.service';
import {
  AUDIT_TRAIL_REPOSITORY_TOKEN,
  ORGANIZATION_ROLE_REPOSITORY_TOKEN,
  RBAC_PERMISSION_REPOSITORY_TOKEN,
} from './interfaces';
import { DRIZZLE } from '@/database/database.constants';
import { CacheService } from '@/common/cache/cache.service';

import { EventEmitter2 } from '@nestjs/event-emitter';

@Global()
@Module({
  providers: [
    {
      provide: AuthService,
      useValue: {
        api: {
          getFullOrganization: mock(),
          getOrgRole: mock(),
          createOrgRole: mock(),
          updateOrgRole: mock(),
          deleteOrgRole: mock(),
        },
      },
    },
    {
      provide: EventEmitter2,
      useValue: { emit: mock() },
    },
    {
      provide: CacheService,
      useValue: {
        get: mock(),
        set: mock(),
        del: mock(),
      },
    },
  ],
  exports: [AuthService, CacheService, EventEmitter2],
})
class FakeAuthModule {}

describe('RbacModule', () => {
  let testingModule: TestingModule;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      imports: [FakeAuthModule, RbacModule],
    })
      .overrideProvider(DRIZZLE)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(testingModule).toBeDefined();
  });

  it('should resolve controllers and providers', () => {
    expect(
      testingModule.get<PermissionsController>(PermissionsController),
    ).toBeDefined();
    expect(
      testingModule.get<PermissionScopeService>(PermissionScopeService),
    ).toBeDefined();
    expect(
      testingModule.get<PermissionScopeCacheService>(
        PermissionScopeCacheService,
      ),
    ).toBeDefined();
    expect(
      testingModule.get<AuditTrailService>(AuditTrailService),
    ).toBeDefined();
    expect(
      testingModule.get<AuditTrailRepository>(AuditTrailRepository),
    ).toBeDefined();
    expect(
      testingModule.get<PermissionScopeInterceptor>(PermissionScopeInterceptor),
    ).toBeDefined();
    expect(
      testingModule.get<OrganizationRoleService>(OrganizationRoleService),
    ).toBeDefined();
    expect(
      testingModule.get<RbacPermissionService>(RbacPermissionService),
    ).toBeDefined();
    expect(testingModule.get(ORGANIZATION_ROLE_REPOSITORY_TOKEN)).toBeDefined();
    expect(testingModule.get(RBAC_PERMISSION_REPOSITORY_TOKEN)).toBeDefined();
    expect(testingModule.get(AUDIT_TRAIL_REPOSITORY_TOKEN)).toBeDefined();
  });
});
