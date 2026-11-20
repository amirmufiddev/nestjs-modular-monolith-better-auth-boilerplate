import type { AuditTrailLog, NewAuditTrailLog } from '@/database/schema';

export const AUDIT_TRAIL_REPOSITORY_TOKEN = Symbol(
  'AUDIT_TRAIL_REPOSITORY_TOKEN',
);

export interface FindAuditLogsParams {
  moduleKey?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface IAuditTrailRepository {
  create(data: NewAuditTrailLog): Promise<AuditTrailLog>;
  findMany(params: FindAuditLogsParams): Promise<AuditTrailLog[]>;
}
