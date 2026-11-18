import { Injectable } from '@nestjs/common';
import { MemberService } from '../application/member.service';
import type { MemberApi } from '../api/member.api';
import type { ListMembersOptions, MemberDto } from '../api/dto/member.dto';

@Injectable()
export class MemberFacade implements MemberApi {
  constructor(private readonly memberService: MemberService) {}

  async listByOrganization(
    organizationId: string,
    options?: ListMembersOptions,
  ): Promise<{ data: MemberDto[]; total: number }> {
    return await this.memberService.listByOrganization(organizationId, options);
  }

  async getById(
    organizationId: string,
    memberId: string,
  ): Promise<MemberDto | null> {
    return await this.memberService.getById(organizationId, memberId);
  }
}
