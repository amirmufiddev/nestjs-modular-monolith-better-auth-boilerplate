import type { OrganizationRole } from '@/database/schema';

export const ORGANIZATION_ROLE_REPOSITORY_TOKEN = Symbol(
  'ORGANIZATION_ROLE_REPOSITORY_TOKEN',
);

export interface IOrganizationRoleRepository {
  findByOrganization(organizationId: string): Promise<OrganizationRole[]>;
  findByOrganizationAndRoleName(
    organizationId: string,
    roleName: string,
  ): Promise<OrganizationRole | undefined>;
  findById(
    organizationId: string,
    roleId: string,
  ): Promise<OrganizationRole | undefined>;
}
