import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseColumns, baseIndexes } from './_base';

export const rbacPermission = pgTable(
  'rbac_permission',
  {
    ...baseColumns,
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    actionDisplayName: text('action_display_name').notNull(),
    actionDescription: text('action_description'),
    resourceDisplayName: text('resource_display_name').notNull(),
    resourceDescription: text('resource_description'),
  },
  (table) => [
    ...baseIndexes(table),
    index('idx_rbac_permission_resource').on(table.resource),
    uniqueIndex('uq_rbac_permission_resource_action_active')
      .on(table.resource, table.action)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export type RbacPermission = typeof rbacPermission.$inferSelect;
export type NewRbacPermission = typeof rbacPermission.$inferInsert;
