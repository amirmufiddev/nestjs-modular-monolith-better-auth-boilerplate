import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { BusinessError } from '@/common/errors/business-error';
import { AppLoggerService } from '@/logger/logger.service';
import {
  MEMBER_REPOSITORY_TOKEN,
  type IMemberRepository,
} from '../interfaces/member-repository.interface';
import type {
  InviteMemberInput,
  ListMembersOptions,
  MemberDto,
  OrgMemberRole,
} from '../dto/member.dto';
import type { MemberAcceptedPayload } from './member-accepted.bridge';
import { OrganizationRoleService } from '@/modules/rbac';

@Injectable()
export class MemberService {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: IMemberRepository,
    private readonly authService: AuthService,
    private readonly logger: AppLoggerService,
    private readonly organizationRoleService: OrganizationRoleService,
  ) {}

  async listByOrganization(
    organizationId: string,
    options?: ListMembersOptions,
  ): Promise<{ data: MemberDto[]; total: number }> {
    const { data: rawRows, total } =
      await this.memberRepo.listByOrganizationPaginated(
        organizationId,
        options,
      );

    const data: MemberDto[] = rawRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      image: row.image,
      role: row.role as OrgMemberRole,
      createdAt: row.createdAt,
    }));

    return { data, total };
  }

  async getById(
    organizationId: string,
    memberId: string,
  ): Promise<MemberDto | null> {
    const raw = await this.memberRepo.findById(organizationId, memberId);
    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      userId: raw.userId,
      name: raw.name,
      email: raw.email,
      phone: raw.phone,
      image: raw.image,
      role: raw.role as OrgMemberRole,
      createdAt: raw.createdAt,
    };
  }

  async inviteMember(input: InviteMemberInput) {
    await this.organizationRoleService.assertAssignableRole(
      input.organizationId,
      input.role,
    );

    if (input.role === 'admin') {
      const inviter = input.inviterUserId
        ? await this.memberRepo.findByUserId(
            input.organizationId,
            input.inviterUserId,
          )
        : null;
      if (inviter?.role !== 'owner') {
        throw BusinessError.forbidden(
          'Hanya owner yang dapat mengundang admin',
          'FORBIDDEN_INVITE_ADMIN',
        );
      }
    }

    const api = this.authService.api as any;
    return await api.createInvitation({
      body: {
        email: input.email,
        role: input.role,
        organizationId: input.organizationId,
      },
      headers: input.headers,
    });
  }

  async updateRole(
    organizationId: string,
    memberId: string,
    role: OrgMemberRole,
    headers?: Record<string, string | string[] | undefined>,
  ) {
    const existing = await this.getById(organizationId, memberId);
    if (!existing) {
      throw BusinessError.notFound('Member', memberId);
    }

    await this.organizationRoleService.assertAssignableRole(
      organizationId,
      role,
    );

    const api = this.authService.api as any;
    return await api.updateMemberRole({
      body: {
        memberId,
        role,
      },
      headers,
    });
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    headers?: Record<string, string | string[] | undefined>,
  ) {
    const member = await this.getById(organizationId, memberId);
    if (!member) {
      throw BusinessError.notFound('Member', memberId);
    }

    const api = this.authService.api as any;
    return await api.removeMember({
      body: {
        memberIdOrEmail: memberId,
      },
      headers,
    });
  }

  handleMemberAccepted(payload: MemberAcceptedPayload): Promise<void> {
    this.logger.log(
      `Member accepted in organization ${payload.organizationId} with role ${payload.role}`,
    );
    return Promise.resolve();
  }
}
