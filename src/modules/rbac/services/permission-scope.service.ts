import { Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  PermissionScopeContext,
  ResolveParams,
  ScopeType,
} from '../types/permission-scope.types';

const SYSTEM_ADMIN_ROLES = ['superadmin', 'admin'];

@Injectable()
export class PermissionScopeService {
  constructor(private readonly authService: AuthService) {}

  async resolveScope(params: ResolveParams): Promise<PermissionScopeContext> {
    const { userId, userRole, activeOrgId, resource, action } = params;
    const permissionKey = `${resource}:${action}`;

    // 1. System admin check → GLOBAL scope
    if (this.isSystemAdmin(userRole)) {
      return {
        type: 'global',
        userId,
        activeOrgId,
      };
    }

    // 2. No active org → OWN scope
    if (!activeOrgId) {
      return {
        type: 'own',
        userId,
      };
    }

    // 3. Get scope from organizationRole.permissionScopes
    const roleWithScope = await this.getOrgRoleWithScope(
      userId,
      activeOrgId,
      permissionKey,
    );

    if (!roleWithScope) {
      return {
        type: 'own',
        userId,
        activeOrgId,
      };
    }

    // 4. Build context based on scope
    const context: PermissionScopeContext = {
      type: roleWithScope.scope,
      userId,
      orgId: activeOrgId,
      activeOrgId,
    };

    // 5. Resolve outletId jika scope = outlet
    if (roleWithScope.scope === 'outlet') {
      const outletId = await this.getUserOutletId(userId, activeOrgId);
      if (outletId) {
        context.outletId = outletId;
      }
    }

    return context;
  }

  /**
   * Create scope context for system jobs (no user session)
   */
  createSystemScope(): PermissionScopeContext {
    return {
      type: 'global',
      userId: 'SYSTEM',
    };
  }

  /**
   * Create scope context for user-initiated background jobs
   */
  async createUserScope(
    userId: string,
    orgId?: string,
    resource?: string,
    action?: string,
  ): Promise<PermissionScopeContext> {
    if (!orgId || !resource || !action) {
      return {
        type: 'own',
        userId,
      };
    }

    return this.resolveScope({
      userId,
      activeOrgId: orgId,
      resource,
      action,
    });
  }

  private isSystemAdmin(role?: string | string[]): boolean {
    if (!role) return false;
    const roles = Array.isArray(role) ? role : role.split(',');
    return roles.some((r) => SYSTEM_ADMIN_ROLES.includes(r.trim()));
  }

  private async getOrgRoleWithScope(
    userId: string,
    orgId: string,
    permissionKey: string,
  ): Promise<{ role: string; scope: ScopeType } | null> {
    try {
      // Get full organization with members
      const orgData = await (this.authService.api as any).getFullOrganization({
        query: { organizationId: orgId },
      });

      if (!orgData) return null;

      // Find user's membership
      const userMember = orgData.members?.find((m: any) => m.userId === userId);
      if (!userMember) return null;

      // Get role details
      const roleData = await (this.authService.api as any).getOrgRole({
        query: { roleName: userMember.role, organizationId: orgId },
      });

      if (!roleData) {
        return { role: userMember.role, scope: 'own' };
      }

      // Get scope from permissionScopes field
      const permissionScopes = this.parsePermissionScopes(
        roleData.permissionScopes,
      );
      const scope = (permissionScopes[permissionKey] || 'own') as ScopeType;

      return { role: userMember.role, scope };
    } catch {
      return null;
    }
  }

  private parsePermissionScopes(scopes: unknown): Record<string, string> {
    if (!scopes) return {};
    if (typeof scopes === 'string') {
      try {
        return JSON.parse(scopes);
      } catch {
        return {};
      }
    }
    if (typeof scopes === 'object') {
      return scopes as Record<string, string>;
    }
    return {};
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async getUserOutletId(
    _userId: string,

    _orgId: string,
  ): Promise<string | undefined> {
    // TODO: implement user outlet resolution
    return undefined;
  }
}
