import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/database/database.constants';
import * as schema from '@/database/schema';
import { OrganizationRole } from '@/database/schema';
import type { IOrganizationRoleRepository } from '../interfaces/organization-role-repository.interface';

@Injectable()
export class OrganizationRoleRepository implements IOrganizationRoleRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByOrganization(
    organizationId: string,
  ): Promise<OrganizationRole[]> {
    return this.db
      .select()
      .from(schema.organizationRole)
      .where(eq(schema.organizationRole.organizationId, organizationId))
      .orderBy(schema.organizationRole.role);
  }

  async findByOrganizationAndRoleName(
    organizationId: string,
    roleName: string,
  ): Promise<OrganizationRole | undefined> {
    const normalized = roleName.toLowerCase();
    const rows = await this.db
      .select()
      .from(schema.organizationRole)
      .where(
        and(
          eq(schema.organizationRole.organizationId, organizationId),
          eq(schema.organizationRole.role, normalized),
        ),
      )
      .limit(1);

    return rows[0];
  }

  async findById(
    organizationId: string,
    roleId: string,
  ): Promise<OrganizationRole | undefined> {
    const rows = await this.db
      .select()
      .from(schema.organizationRole)
      .where(
        and(
          eq(schema.organizationRole.organizationId, organizationId),
          eq(schema.organizationRole.id, roleId),
        ),
      )
      .limit(1);

    return rows[0];
  }
}
