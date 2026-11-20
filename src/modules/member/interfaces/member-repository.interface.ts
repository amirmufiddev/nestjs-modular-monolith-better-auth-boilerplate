import type { ListMembersOptions } from '../dto/member.dto';
import type { ListMemberQueryDto } from '../dto/list-member-query.dto';
import type { MemberResponseDto } from '../dto/member-response.dto';
import type { PendingMemberLink } from '../repositories/pending-member-link.schema';

export const MEMBER_REPOSITORY_TOKEN = Symbol('MEMBER_REPOSITORY_TOKEN');

export interface MemberRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  name?: string;
  email?: string;
  phone?: string | null;
  image?: string | null;
}

export interface RawMemberRow {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
}

export interface IMemberRepository {
  listByOrganizationPaginated(
    organizationId: string,
    options?: ListMembersOptions,
  ): Promise<{ data: RawMemberRow[]; total: number }>;
  findById(
    organizationId: string,
    memberId?: string,
  ): Promise<RawMemberRow | null>;
  findByUserId(
    organizationId: string,
    userId: string,
  ): Promise<RawMemberRow | null>;
  findByOrgAndUser?(
    orgId: string,
    userId: string,
  ): Promise<RawMemberRow | null>;
  listByOrg?(
    orgId: string,
    query: ListMemberQueryDto,
  ): Promise<{ data: MemberResponseDto[]; total: number }>;
  upsertPendingLink(
    organizationId: string,
    email: string,
    role: string,
  ): Promise<PendingMemberLink>;
  findPendingLink(
    organizationId: string,
    email: string,
  ): Promise<PendingMemberLink | null>;
  deletePendingLink(organizationId: string, email: string): Promise<void>;
  updateRole?(memberId: string, role: string): Promise<MemberRecord>;
  delete?(memberId: string): Promise<void>;
}
