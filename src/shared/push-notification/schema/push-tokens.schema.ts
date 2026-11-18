import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { baseColumns, baseIndexes } from '@/database/schema/_base';

export const pushTokens = pgTable(
  'push_tokens',
  {
    ...baseColumns,
    organizationId: text('organization_id'),
    userId: text('user_id').notNull(),
    fcmToken: text('fcm_token').notNull(),
    platform: varchar('platform', { length: 16 }).notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
  },
  (table) => [
    ...baseIndexes(table),
    uniqueIndex('uq_push_tokens_fcm_token').on(table.fcmToken),
  ],
);

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
