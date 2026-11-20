import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/database/database.constants';
import * as schema from '@/database/schema';
import { RbacRoleTemplate } from '@/database/schema';

@Injectable()
export class RbacRoleTemplateRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(): Promise<RbacRoleTemplate[]> {
    return this.db.select().from(schema.rbacRoleTemplate);
  }
}
