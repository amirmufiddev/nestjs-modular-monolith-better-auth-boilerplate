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

@Global()
@Module({
  imports: [DatabaseModule, SharedEventsModule],
  controllers: [PermissionsController, OrganizationRolesController],
  providers: [
    RbacPermissionRepository,
    RbacRoleTemplateRepository,
    OrganizationRoleRepository,
    RbacPermissionService,
    OrganizationRoleService,
    PermissionScopeService,
    PermissionScopeCacheService,
    AuditTrailService,
    AuditTrailRepository,
    PermissionScopeInterceptor,
  ],
  exports: [
    PermissionScopeService,
    PermissionScopeCacheService,
    AuditTrailService,
    PermissionScopeInterceptor,
    AuditTrailRepository,
    RbacPermissionService,
    OrganizationRoleService,
    OrganizationRoleRepository,
  ],
})
export class RbacModule {}
