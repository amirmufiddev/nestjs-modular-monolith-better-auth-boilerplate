import { describe, expect, it } from 'bun:test';
import { buildAdminRoleDbPayload } from './admin-role-db-payload';

describe('buildAdminRoleDbPayload', () => {
  it('should serialize restricted admin defaults without extra resources', () => {
    const payload = buildAdminRoleDbPayload();
    const permission = JSON.parse(payload.permission) as Record<
      string,
      string[]
    >;
    const scopes = JSON.parse(payload.permissionScopes) as Record<
      string,
      string
    >;

    expect(permission.broadcast).toEqual(['trigger']);
    expect(permission.order).toBeUndefined();
    expect(scopes['broadcast:trigger']).toBe('organization');
    expect(scopes['payment:read']).toBeUndefined();
  });
});
