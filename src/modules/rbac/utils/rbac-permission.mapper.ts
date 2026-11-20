import type { RbacPermission } from '@/database/schema';
import type {
  PermissionCodeDto,
  ResourcePermissionDto,
} from '../dto/permission.dto';

export function buildBetterAuthStatementFromRows(
  rows: Pick<RbacPermission, 'resource' | 'action'>[],
): Record<string, readonly string[]> {
  const statement: Record<string, string[]> = {};

  for (const row of rows) {
    if (!statement[row.resource]) {
      statement[row.resource] = [];
    }
    if (!statement[row.resource].includes(row.action)) {
      statement[row.resource].push(row.action);
    }
  }

  for (const key of Object.keys(statement)) {
    statement[key].sort();
  }

  return statement;
}

export function buildPermissionCatalogView(rows: RbacPermission[]): {
  resources: ResourcePermissionDto[];
  permissions: PermissionCodeDto[];
} {
  const resourceMap = new Map<string, ResourcePermissionDto>();
  const permissions: PermissionCodeDto[] = [];

  for (const row of rows) {
    let resource = resourceMap.get(row.resource);
    if (!resource) {
      resource = {
        resource: row.resource,
        displayName: row.resourceDisplayName,
        description: row.resourceDescription ?? undefined,
        actions: {},
      };
      resourceMap.set(row.resource, resource);
    }

    resource.actions[row.action] = {
      displayName: row.actionDisplayName,
      description: row.actionDescription ?? undefined,
    };

    permissions.push({
      code: `${row.resource}:${row.action}`,
      resource: row.resource,
      action: row.action,
      displayName: row.actionDisplayName,
    });
  }

  const resources = [...resourceMap.values()].sort((a, b) =>
    a.resource.localeCompare(b.resource),
  );

  permissions.sort((a, b) => a.code.localeCompare(b.code));

  return { resources, permissions };
}

export function buildAllPermissionCodes(
  rows: Pick<RbacPermission, 'resource' | 'action'>[],
): string[] {
  return rows
    .map((row) => `${row.resource}:${row.action}`)
    .sort((a, b) => a.localeCompare(b));
}
