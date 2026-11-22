import {
  BOOTSTRAP_BETTER_AUTH_STATEMENT,
  getDefaultRolePermissions,
  getDefaultPermissionScopes,
} from '@/modules/rbac/constants/permissions.constant';
import type { Seeder, SeederContext } from './seeder.interface';

export function buildRbacPermissionRows(): Array<{
  resource: string;
  action: string;
  actionDisplayName: string;
  actionDescription: string;
  resourceDisplayName: string;
  resourceDescription: string;
}> {
  const rows: Array<{
    resource: string;
    action: string;
    actionDisplayName: string;
    actionDescription: string;
    resourceDisplayName: string;
    resourceDescription: string;
  }> = [];

  for (const [resource, actions] of Object.entries(
    BOOTSTRAP_BETTER_AUTH_STATEMENT,
  )) {
    for (const action of actions) {
      rows.push({
        resource,
        action,
        actionDisplayName: action,
        actionDescription: `Permission to ${action} ${resource}`,
        resourceDisplayName: resource,
        resourceDescription: `Resource ${resource}`,
      });
    }
  }

  return rows;
}

export function buildRbacRoleTemplateRows(): Array<{
  roleName: string;
  permission: string;
  permissionScopes: string;
}> {
  const rolePermissions = getDefaultRolePermissions();
  const roleScopes = getDefaultPermissionScopes();

  const roleNames = Array.from(
    new Set([...Object.keys(rolePermissions), ...Object.keys(roleScopes)]),
  );

  return roleNames.map((roleName) => ({
    roleName,
    permission: JSON.stringify(rolePermissions[roleName] ?? {}),
    permissionScopes: JSON.stringify(roleScopes[roleName] ?? {}),
  }));
}

export const rbacSeeder: Seeder = {
  name: 'rbac',
  async run({ pool }: SeederContext): Promise<void> {
    const permissions = buildRbacPermissionRows();
    const roleTemplates = buildRbacRoleTemplateRows();

    // Insert permissions (active unique index uq_rbac_permission_resource_action_active where deleted_at is null)
    for (const perm of permissions) {
      await pool.query(
        `
        INSERT INTO "rbac_permission" (
          "resource",
          "action",
          "action_display_name",
          "action_description",
          "resource_display_name",
          "resource_description"
        )
        SELECT $1, $2, $3, $4, $5, $6
        WHERE NOT EXISTS (
          SELECT 1 FROM "rbac_permission"
          WHERE "resource" = $1 AND "action" = $2 AND "deleted_at" IS NULL
        );
        `,
        [
          perm.resource,
          perm.action,
          perm.actionDisplayName,
          perm.actionDescription,
          perm.resourceDisplayName,
          perm.resourceDescription,
        ],
      );
    }

    // Insert or update role templates
    for (const tmpl of roleTemplates) {
      await pool.query(
        `
        INSERT INTO "rbac_role_template" ("role_name", "permission", "permission_scopes", "created_at", "updated_at")
        VALUES ($1, $2, $3, now(), now())
        ON CONFLICT ("role_name") DO UPDATE
          SET "permission" = EXCLUDED.permission,
              "permission_scopes" = EXCLUDED.permission_scopes,
              "updated_at" = now();
        `,
        [tmpl.roleName, tmpl.permission, tmpl.permissionScopes],
      );
    }
  },
};
