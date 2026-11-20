/**
 * Bootstrap fallback saat tabel `rbac_permission` belum terisi (mis. unit test auth).
 * Produksi memuat statement dari database via `loadBetterAuthStatement`.
 */
export const BOOTSTRAP_BETTER_AUTH_STATEMENT: Record<
  string,
  readonly string[]
> = {
  member: ['read', 'invite', 'remove', 'update-role'],
  ac: ['create', 'read', 'update', 'delete'],
  broadcast: ['trigger'],
};

/** @deprecated Gunakan RbacPermissionService / database. Hanya untuk backward-compat test. */
export const MASTER_PERMISSIONS = Object.fromEntries(
  Object.entries(BOOTSTRAP_BETTER_AUTH_STATEMENT).map(([resource, actions]) => [
    resource,
    {
      resource,
      displayName: resource,
      actions: Object.fromEntries(
        actions.map((action) => [action, { displayName: action }]),
      ),
    },
  ]),
);

/** @deprecated */
export function getBetterAuthStatement(
  statement: Record<
    string,
    readonly string[]
  > = BOOTSTRAP_BETTER_AUTH_STATEMENT,
): Record<string, readonly string[]> {
  return statement;
}

/** @deprecated */
export function getAllPermissionCodes(): string[] {
  const codes: string[] = [];
  for (const [resource, actions] of Object.entries(
    BOOTSTRAP_BETTER_AUTH_STATEMENT,
  )) {
    for (const action of actions) {
      codes.push(`${resource}:${action}`);
    }
  }
  return codes;
}

/** @deprecated Dipakai seed legacy; org baru memakai `rbac_role_template`. */
export function getDefaultRolePermissions(): Record<
  string,
  Record<string, string[]>
> {
  return {
    owner: Object.fromEntries(
      Object.entries(BOOTSTRAP_BETTER_AUTH_STATEMENT).map(([key, actions]) => [
        key,
        [...actions],
      ]),
    ),
    admin: {
      member: ['read', 'invite', 'remove', 'update-role'],
      ac: ['read'],
      broadcast: ['trigger'],
    },
    member: {
      member: ['read'],
    },
  };
}

/** @deprecated */
export function getDefaultPermissionScopes(): Record<
  string,
  Record<string, string>
> {
  return {
    owner: Object.fromEntries(
      getAllPermissionCodes().map((code) => [code, 'organization']),
    ),
    admin: {
      'member:read': 'organization',
      'member:invite': 'organization',
      'member:remove': 'organization',
      'member:update-role': 'organization',
      'ac:read': 'organization',
      'broadcast:trigger': 'organization',
    },
    member: {
      'member:read': 'organization',
    },
  };
}
