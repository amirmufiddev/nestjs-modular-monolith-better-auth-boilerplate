import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/database/database.constants';
import * as schema from '@/database/schema';
import { AuditTrailLog, NewAuditTrailLog } from '@/database/schema';
import type { FindAuditLogsParams, IAuditTrailRepository } from '../interfaces';

export type { FindAuditLogsParams };

@Injectable()
export class AuditTrailRepository implements IAuditTrailRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: NewAuditTrailLog): Promise<AuditTrailLog> {
    const result = await this.db
      .insert(schema.auditTrailLogs)
      .values(data)
      .returning();

    return result[0];
  }

  async findMany(params: FindAuditLogsParams): Promise<AuditTrailLog[]> {
    const conditions = [];

    if (params.moduleKey) {
      conditions.push(eq(schema.auditTrailLogs.moduleKey, params.moduleKey));
    }
    if (params.actorId) {
      conditions.push(eq(schema.auditTrailLogs.actorId, params.actorId));
    }
    if (params.entityType) {
      conditions.push(eq(schema.auditTrailLogs.entityType, params.entityType));
    }
    if (params.entityId) {
      conditions.push(eq(schema.auditTrailLogs.entityId, params.entityId));
    }
    if (params.startDate) {
      conditions.push(gte(schema.auditTrailLogs.createdAt, params.startDate));
    }
    if (params.endDate) {
      conditions.push(lte(schema.auditTrailLogs.createdAt, params.endDate));
    }

    return this.db
      .select()
      .from(schema.auditTrailLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.auditTrailLogs.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0);
  }
}
