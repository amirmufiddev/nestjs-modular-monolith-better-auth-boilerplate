import type { MemberDto, ListMembersOptions } from './dto/member.dto';

export const MEMBER_API = Symbol('MEMBER_API');

export interface MemberApi {
  listByOrganization(
    organizationId: string,
    options?: ListMembersOptions,
  ): Promise<{ data: MemberDto[]; total: number }>;
  getById(organizationId: string, memberId: string): Promise<MemberDto | null>;
}
