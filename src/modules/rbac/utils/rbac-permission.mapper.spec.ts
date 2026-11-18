import { describe, expect, it } from 'bun:test';
import {
  buildAllPermissionCodes,
  buildBetterAuthStatementFromRows,
  buildPermissionCatalogView,
} from './rbac-permission.mapper';
import type { RbacPermission } from '@/database/schema';

const sampleRow = (overrides: Partial<RbacPermission> = {}): RbacPermission =>
  ({
    id: 'id-1',
    resource: 'member',
    action: 'read',
    actionDisplayName: 'Lihat Anggota',
    actionDescription: null,
    resourceDisplayName: 'Anggota',
    resourceDescription: 'Manajemen anggota',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as RbacPermission;

describe('rbac-permission.mapper', () => {
  it('buildBetterAuthStatementFromRows groups actions per resource', () => {
    const statement = buildBetterAuthStatementFromRows([
      { resource: 'member', action: 'read' },
      { resource: 'member', action: 'invite' },
      { resource: 'ac', action: 'read' },
    ]);

    expect(statement.member).toEqual(['invite', 'read']);
    expect(statement.ac).toEqual(['read']);
  });

  it('buildPermissionCatalogView maps rows to API shape', () => {
    const view = buildPermissionCatalogView([sampleRow()]);
    expect(view.resources[0].resource).toBe('member');
    expect(view.permissions[0].code).toBe('member:read');
  });

  it('buildAllPermissionCodes returns sorted codes', () => {
    const codes = buildAllPermissionCodes([
      { resource: 'ac', action: 'read' },
      { resource: 'member', action: 'read' },
    ]);
    expect(codes).toEqual(['ac:read', 'member:read']);
  });
});