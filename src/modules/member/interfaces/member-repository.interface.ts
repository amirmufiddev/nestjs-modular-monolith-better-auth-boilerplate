import type { ListMembersOptions } from '../dto/member.dto';
import type { PendingMemberLink } from '@/database/schema';

export const MEMBER_REPOSITORY_TOKEN = Symbol('MEMBER_REPOSITORY_TOKEN');

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
    memberId: string,
  ): Promise<RawMemberRow | null>;
  findByUserId(
    organizationId: string,
    userId: string,
  ): Promise<RawMemberRow | null>;
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
}
