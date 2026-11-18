import {
  getDefaultPermissionScopes,
  getDefaultRolePermissions,
} from './permissions.constant';

export function buildAdminRoleDbPayload(): {
  permission: string;
  permissionScopes: string;
} {
  return {
    permission: JSON.stringify(getDefaultRolePermissions().admin),
    permissionScopes: JSON.stringify(getDefaultPermissionScopes().admin),
  };
}
