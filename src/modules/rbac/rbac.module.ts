import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { SharedEventsModule } from '@/shared/events/shared-events.module';
import { PermissionScopeService } from './services/permission-scope.service';
import { PermissionScopeCacheService } from './services/permission-scope-cache.service';
import { AuditTrailService } from './services/audit-trail.service';
import { AuditTrailRepository } from './repositories/audit-trail.repository';
import { PermissionsController } from './controllers/permissions.controller';
import { OrganizationRolesController } from './controllers/organization-roles.controller';
import { RbacPermissionRepository } from './repositories/rbac-permission.repository';
import { RbacRoleTemplateRepository } from './repositories/rbac-role-template.repository';
import { OrganizationRoleRepository } from './repositories/organization-role.repository';
import { RbacPermissionService } from './services/rbac-permission.service';
import { OrganizationRoleService } from './services/organization-role.service';
import { PermissionScopeInterceptor } from './interceptors/permission-scope.interceptor';
import {
  AUDIT_TRAIL_REPOSITORY_TOKEN,
  ORGANIZATION_ROLE_REPOSITORY_TOKEN,
  RBAC_PERMISSION_REPOSITORY_TOKEN,
} from './interfaces';

const auditTrailRepositoryProvider = {
  provide: AUDIT_TRAIL_REPOSITORY_TOKEN,
  useClass: AuditTrailRepository,
};

@Global()
@Module({
  imports: [DatabaseModule, SharedEventsModule],
  controllers: [PermissionsController, OrganizationRolesController],
  providers: [
    {
      provide: RBAC_PERMISSION_REPOSITORY_TOKEN,
      useClass: RbacPermissionRepository,
    },
    {
      provide: ORGANIZATION_ROLE_REPOSITORY_TOKEN,
      useClass: OrganizationRoleRepository,
    },
    auditTrailRepositoryProvider,
    AuditTrailRepository,
    RbacRoleTemplateRepository,
    RbacPermissionService,
    OrganizationRoleService,
    PermissionScopeService,
    PermissionScopeCacheService,
    AuditTrailService,
    PermissionScopeInterceptor,
  ],
  exports: [
    PermissionScopeService,
    PermissionScopeCacheService,
    AuditTrailService,
    PermissionScopeInterceptor,
    AuditTrailRepository,
    auditTrailRepositoryProvider,
    AUDIT_TRAIL_REPOSITORY_TOKEN,
    RbacPermissionService,
    OrganizationRoleService,
    ORGANIZATION_ROLE_REPOSITORY_TOKEN,
    RBAC_PERMISSION_REPOSITORY_TOKEN,
  ],
})
export class RbacModule {}
