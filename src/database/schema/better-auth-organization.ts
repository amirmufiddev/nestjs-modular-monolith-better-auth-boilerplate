import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const organization = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').unique(),
    logo: text('logo'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    metadata: text('metadata'),
  },
  (table) => [index('idx_organization_slug').on(table.slug)],
);

export type Organization = typeof organization.$inferSelect;
export type NewOrganization = typeof organization.$inferInsert;

export const organizationRole = pgTable('organization_role', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  permission: text('permission').default('{}'),
  permissionScopes: text('permission_scopes').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type OrganizationRole = typeof organizationRole.$inferSelect;
export type NewOrganizationRole = typeof organizationRole.$inferInsert;
