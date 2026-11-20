import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Template role default per organisasi baru (owner, admin, member). */
export const rbacRoleTemplate = pgTable('rbac_role_template', {
  roleName: text('role_name').primaryKey(),
  permission: text('permission').notNull(),
  permissionScopes: text('permission_scopes').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type RbacRoleTemplate = typeof rbacRoleTemplate.$inferSelect;
export type NewRbacRoleTemplate = typeof rbacRoleTemplate.$inferInsert;
