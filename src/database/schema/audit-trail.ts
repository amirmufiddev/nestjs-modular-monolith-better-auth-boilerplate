import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { user } from './better-auth-user';

export const auditTrailLogs = pgTable(
  'audit_trail_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleKey: text('module_key').notNull(),
    actorId: text('actor_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_trail_logs_module_key').on(table.moduleKey),
    index('idx_audit_trail_logs_actor_id').on(table.actorId),
    index('idx_audit_trail_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_trail_logs_created_at').on(table.createdAt),
  ],
);

export type AuditTrailLog = typeof auditTrailLogs.$inferSelect;
export type NewAuditTrailLog = typeof auditTrailLogs.$inferInsert;
