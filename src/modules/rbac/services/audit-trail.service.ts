import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_TRAIL_REPOSITORY_TOKEN,
  type IAuditTrailRepository,
} from '../interfaces';
import type { AuditTrailLog } from '@/database/schema';

export interface LogAuditParams {
  moduleKey: string;
  actorId: string;
  action: 'create' | 'update' | 'delete' | 'assign' | 'revoke';
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditTrailService {
  constructor(
    @Inject(AUDIT_TRAIL_REPOSITORY_TOKEN)
    private readonly auditTrailRepo: IAuditTrailRepository,
  ) {}

  async log(params: LogAuditParams): Promise<AuditTrailLog> {
    return this.auditTrailRepo.create({
      moduleKey: params.moduleKey,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue,
      newValue: params.newValue,
      metadata: params.metadata ?? {},
    } as any);
  }

  async logRbacChange(
    actorId: string,
    action: LogAuditParams['action'],
    entityType: string,
    entityId: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<AuditTrailLog> {
    return this.log({
      moduleKey: 'rbac',
      actorId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      metadata,
    });
  }

  async findByModule(
    moduleKey: string,
    limit = 50,
    offset = 0,
  ): Promise<AuditTrailLog[]> {
    return this.auditTrailRepo.findMany({ moduleKey, limit, offset });
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditTrailLog[]> {
    return this.auditTrailRepo.findMany({ entityType, entityId });
  }
}
