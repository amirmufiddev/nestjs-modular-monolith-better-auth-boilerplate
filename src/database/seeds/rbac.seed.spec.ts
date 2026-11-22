import { describe, expect, it, mock } from 'bun:test';
import {
  buildRbacPermissionRows,
  buildRbacRoleTemplateRows,
  rbacSeeder,
} from './rbac.seed';

describe('RBAC Seeder', () => {
  it('buildRbacPermissionRows should generate rows for all actions in bootstrap statement', () => {
    const rows = buildRbacPermissionRows();
    expect(rows.length).toBeGreaterThan(0);

    const memberRead = rows.find(
      (r) => r.resource === 'member' && r.action === 'read',
    );
    expect(memberRead).toBeDefined();
    expect(memberRead?.resourceDisplayName).toBe('member');
    expect(memberRead?.actionDisplayName).toBe('read');
  });

  it('buildRbacRoleTemplateRows should produce templates for owner, admin, and member', () => {
    const templates = buildRbacRoleTemplateRows();
    const roleNames = templates.map((t) => t.roleName);

    expect(roleNames).toContain('owner');
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('member');

    for (const t of templates) {
      expect(() => JSON.parse(t.permission)).not.toThrow();
      expect(() => JSON.parse(t.permissionScopes)).not.toThrow();
    }
  });

  it('rbacSeeder.run should execute inserts into rbac_permission and rbac_role_template', async () => {
    const executedQueries: string[] = [];
    const queryMock = mock((sql: string) => {
      executedQueries.push(sql);
      return Promise.resolve({ rows: [] });
    });

    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext = { db: {} as any, pool: fakePool };

    await rbacSeeder.run(fakeContext);

    expect(
      executedQueries.some((q) => q.includes('INSERT INTO "rbac_permission"')),
    ).toBe(true);
    expect(
      executedQueries.some((q) => q.includes('INSERT INTO "rbac_role_template"')),
    ).toBe(true);
  });
});
