/** Nama role sesuai baris `organization_role.role` (lowercase). */
export type OrgMemberRole = string;

export interface MemberDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  role: OrgMemberRole;
  createdAt: Date;
}

export interface InviteMemberInput {
  organizationId: string;
  email: string;
  role: OrgMemberRole;
  inviterUserId?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ListMembersOptions {
  role?: OrgMemberRole;
  search?: string;
  limit?: number;
  offset?: number;
}
