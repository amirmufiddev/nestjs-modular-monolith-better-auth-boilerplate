import { BusinessError } from '@/common/errors/business-error';
import { RlsContext } from '@/shared/database/rls-context';
import { MemberController } from './member.controller';

describe('MemberController', () => {
  let controller: MemberController;
  let service: any;

  const mockOrgId = 'org-123';
  const mockHeaders = { 'content-type': 'application/json' };
  const mockReq = { headers: mockHeaders } as any;
  const mockSession = { user: { id: 'usr-owner' } } as any;

  beforeEach(() => {
    service = {
      listByOrganization: jest.fn(),
      getById: jest.fn(),
      inviteMember: jest.fn(),
      updateRole: jest.fn(),
      removeMember: jest.fn(),
    };

    controller = new MemberController(service);
    jest
      .spyOn(RlsContext, 'getCurrentOrganizationId')
      .mockReturnValue(mockOrgId);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw unauthorized if organization context is missing', async () => {
    jest.spyOn(RlsContext, 'getCurrentOrganizationId').mockReturnValue(null);

    await expect(
      controller.list({ limit: 10, page: 1 } as any),
    ).rejects.toThrow(BusinessError);
  });

  it('should list members paginated', async () => {
    service.listByOrganization.mockResolvedValue({ data: [], total: 0 });

    await controller.list({ limit: 10, page: 1 } as any);

    expect(service.listByOrganization).toHaveBeenCalledWith(mockOrgId, {
      limit: 10,
      offset: undefined,
      role: undefined,
      search: undefined,
    });
  });

  it('should invite member', async () => {
    service.inviteMember.mockResolvedValue({
      id: 'inv-1',
      email: 'test@example.com',
    });

    await controller.invite(
      { email: 'test@example.com', role: 'member' },
      mockReq,
      mockSession,
    );

    expect(service.inviteMember).toHaveBeenCalledWith({
      organizationId: mockOrgId,
      email: 'test@example.com',
      role: 'member',
      inviterUserId: 'usr-owner',
      headers: mockHeaders,
    });
  });
});
