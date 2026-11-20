import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/database/database.constants';
import * as schema from '@/database/schema';
import { NewRbacPermission, RbacPermission } from '@/database/schema';
import { BaseRepository } from '@/common/repository/base.repository';
import type { IRbacPermissionRepository } from '../interfaces/rbac-permission-repository.interface';

@Injectable()
export class RbacPermissionRepository
  extends BaseRepository<typeof schema.rbacPermission>
  implements IRbacPermissionRepository
{
  constructor(@Inject(DRIZZLE) db: NodePgDatabase) {
    super(db, schema.rbacPermission);
  }

  async findAllActive(): Promise<RbacPermission[]> {
    return this.findAll({
      orderBy: undefined,
    });
  }

  async findByResourceAndAction(
    resource: string,
    action: string,
  ): Promise<RbacPermission | undefined> {
    const rows = await this.db
      .select()
      .from(schema.rbacPermission)
      .where(
        and(
          eq(schema.rbacPermission.resource, resource),
          eq(schema.rbacPermission.action, action),
          isNull(schema.rbacPermission.deletedAt),
        ),
      )
      .limit(1);

    return rows[0];
  }

  async findActiveById(id: string): Promise<RbacPermission | undefined> {
    const row = await super.findById(id);
    if (!row || row.deletedAt) {
      return undefined;
    }
    return row;
  }

  async createPermission(data: NewRbacPermission): Promise<RbacPermission> {
    const result = await this.db
      .insert(schema.rbacPermission)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return result[0];
  }

  async updatePermission(
    id: string,
    data: Partial<
      Pick<
        RbacPermission,
        | 'actionDisplayName'
        | 'actionDescription'
        | 'resourceDisplayName'
        | 'resourceDescription'
      >
    >,
  ): Promise<RbacPermission | undefined> {
    const result = await this.db
      .update(schema.rbacPermission)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.rbacPermission.id, id),
          isNull(schema.rbacPermission.deletedAt),
        ),
      )
      .returning();

    return result[0];
  }
}
