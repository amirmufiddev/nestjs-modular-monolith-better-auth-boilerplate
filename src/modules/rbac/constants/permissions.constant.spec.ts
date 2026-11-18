import { describe, expect, it } from 'bun:test';
import {
  BOOTSTRAP_BETTER_AUTH_STATEMENT,
  getBetterAuthStatement,
  getAllPermissionCodes,
  getDefaultRolePermissions,
  getDefaultPermissionScopes,
} from './permissions.constant';

describe('permissions.constant', () => {
  it('should define boilerplate resources only', () => {
    expect(Object.keys(BOOTSTRAP_BETTER_AUTH_STATEMENT).sort()).toEqual(
      ['ac', 'broadcast', 'member'].sort(),
    );
  });

  it('should generate Better Auth statement from actions', () => {
    const statement = getBetterAuthStatement();
    expect(statement.member).toContain('read');
    expect(statement.broadcast).toEqual(['trigger']);
  });

  it('should list flat permission codes', () => {
    const codes = getAllPermissionCodes();
    expect(codes).toContain('ac:read');
    expect(codes).toContain('broadcast:trigger');
    expect(codes).not.toContain('payment:write');
  });

  it('should define default admin role without removed domain permissions', () => {
    const roles = getDefaultRolePermissions();
    expect(roles.admin.broadcast).toEqual(['trigger']);
    expect(roles.admin).not.toHaveProperty('order');
  });

  it('should define permission scopes for admin and member', () => {
    const scopes = getDefaultPermissionScopes();
    expect(scopes.admin['member:read']).toBe('organization');
    expect(scopes.member['member:read']).toBe('organization');
  });
});
