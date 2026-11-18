import { describe, expect, it, mock } from 'bun:test';
import { MemberFacade } from './member.facade';
import { MemberService } from '../application/member.service';

describe('MemberFacade', () => {
  it('should delegate listByOrganization to MemberService', async () => {
    const expectedResult = { data: [], total: 0 };
    const service = {
      listByOrganization: mock(() => Promise.resolve(expectedResult)),
    } as unknown as MemberService;

    const facade = new MemberFacade(service);
    const result = await facade.listByOrganization('org-1', { limit: 5 });

    expect(service.listByOrganization).toHaveBeenCalledWith('org-1', {
      limit: 5,
    });
    expect(result).toBe(expectedResult);
  });
});
