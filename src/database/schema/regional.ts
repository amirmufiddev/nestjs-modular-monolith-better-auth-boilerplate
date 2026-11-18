import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  varchar,
} from 'drizzle-orm/pg-core';

export const regionalLevelEnum = pgEnum('regional_level', [
  'province',
  'regency',
  'district',
  'village',
]);

/**
 * Regional address master-data table.
 *
 * `code` and `parent_code` are stored as PostgreSQL `bigint` (decoded as JS
 * `number` via Drizzle's `{ mode: 'number' }`) — the dots present in the source
 * dataset (e.g. `11.01.01.2001`) are stripped at ingestion time so lookups and
 * joins are pure integer comparisons. `name` remains plain text and
 * `postal_code` is a short string. Postal code for the dataset is not part of
 * the upstream `wilayah.sql` so the column is intentionally left null for now.
 */
export const regionalAddresses = pgTable(
  'regional_addresses',
  {
    code: bigint('code', { mode: 'number' }).primaryKey(),
    name: text('name').notNull(),
    level: regionalLevelEnum('level').notNull(),
    parentCode: bigint('parent_code', { mode: 'number' }),
    postalCode: varchar('postal_code', { length: 10 }),
  },
  (table) => [
    index('idx_regional_parent_code').on(table.parentCode),
    index('idx_regional_level').on(table.level),
  ],
);

export type RegionalAddress = typeof regionalAddresses.$inferSelect;
export type NewRegionalAddress = typeof regionalAddresses.$inferInsert;
