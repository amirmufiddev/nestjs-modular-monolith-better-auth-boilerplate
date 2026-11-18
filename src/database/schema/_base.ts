import { AnyPgColumn, index, timestamp, uuid } from 'drizzle-orm/pg-core';

export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
};

export const baseIndexes = (table: {
  createdAt: AnyPgColumn;
  deletedAt: AnyPgColumn;
}) => [index().on(table.createdAt), index().on(table.deletedAt)];
