import { pgTable, text, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { organization } from './better-auth-organization';
import { baseColumns, baseIndexes } from './_base';

export const pendingMemberLinks = pgTable(
  'pending_member_links',
  {
    ...baseColumns,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 32 }).notNull(),
  },
  (table) => [
    ...baseIndexes(table),
    uniqueIndex('idx_pending_member_links_org_email').on(
      table.organizationId,
      table.email,
    ),
  ],
);

export type PendingMemberLink = typeof pendingMemberLinks.$inferSelect;
export type NewPendingMemberLink = typeof pendingMemberLinks.$inferInsert;
