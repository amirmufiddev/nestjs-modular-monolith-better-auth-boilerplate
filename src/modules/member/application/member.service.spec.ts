import { describe, expect, mock, test } from 'bun:test';
import { MemberService } from './member.service';

const mockOrgId = 'org-123';

describe('MemberService (boilerplate)', () => {
  const repo = {
    listByOrganizationPaginated: mock(() =>
      Promise.resolve({
        data: [
          {
            id: 'm1',
            userId: 'u1',
            name: 'Test',
            email: 't@example.com',
            phone: null,
            image: null,
            role: 'member',
            createdAt: new Date(),
          },
        ],
        total: 1,
      }),
    ),
    findById: mock(() => Promise.resolve(null)),
    findByUserId: mock(() => Promise.resolve({ role: 'owner' })),
  };

  const authService = {
    api: { createInvitation: mock(() => Promise.resolve({ id: 'inv' })) },
  };
  const logger = { log: mock(() => undefined) };
  const organizationRoleService = {
    assertAssignableRole: mock(() => Promise.resolve()),
  };

  const service = new MemberService(
    repo as any,
    authService as any,
    logger as any,
    organizationRoleService as any,
  );

  test('listByOrganization returns members', async () => {
    const result = await service.listByOrganization(mockOrgId);
    expect(result.total).toBe(1);
    expect(result.data[0].email).toBe('t@example.com');
  });

  test('inviteMember calls Better Auth API', async () => {
    await service.inviteMember({
      organizationId: mockOrgId,
      email: 'new@example.com',
      role: 'member',
    });
    expect(authService.api.createInvitation).toHaveBeenCalled();
  });
});
