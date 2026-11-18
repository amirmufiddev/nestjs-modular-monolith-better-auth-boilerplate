import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { MemberHasPermission } from '@thallesp/nestjs-better-auth';
import { ScopeMeta } from '../types/permission-scope.types';
import { PermissionScopeInterceptor } from '../interceptors/permission-scope.interceptor';

export const SCOPE_META_KEY = 'permission_scope_meta';

/**
 * Combined decorator for permission check + scope resolution
 *
 * @param permission - Format: "resource:action" (e.g., "transaction:read")
 *
 * @example
 * @RequirePermission('transaction:read')
 * @RequirePermission('member:update')
 */
export const RequirePermission = (permission: string) => {
  const [resource, action] = permission.split(':');

  if (!resource || !action) {
    throw new Error(
      `Invalid permission format: "${permission}". Expected "resource:action"`,
    );
  }

  return applyDecorators(
    MemberHasPermission({ permissions: { [resource]: [action] } }),
    SetMetadata(SCOPE_META_KEY, { resource, action } as ScopeMeta),
    UseInterceptors(PermissionScopeInterceptor),
  );
};

/**
 * Multiple permissions (all must be satisfied)
 *
 * @example
 * @RequirePermissions(['transaction:read', 'transaction:update'])
 */
export const RequirePermissions = (permissions: string[]) => {
  const permissionMap: Record<string, string[]> = {};
  let firstResource = '';
  let firstAction = '';

  for (const perm of permissions) {
    const [resource, action] = perm.split(':');
    if (!resource || !action) {
      throw new Error(
        `Invalid permission format: "${perm}". Expected "resource:action"`,
      );
    }

    if (!firstResource) {
      firstResource = resource;
      firstAction = action;
    }

    if (!permissionMap[resource]) {
      permissionMap[resource] = [];
    }
    permissionMap[resource].push(action);
  }

  return applyDecorators(
    MemberHasPermission({ permissions: permissionMap }),
    SetMetadata(SCOPE_META_KEY, {
      resource: firstResource,
      action: firstAction,
    } as ScopeMeta),
    UseInterceptors(PermissionScopeInterceptor),
  );
};
