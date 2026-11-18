import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    role: text('role'),
    banned: boolean('banned').default(false),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires'),
    username: text('username').unique(),
    displayUsername: text('display_username'),
    phoneNumber: text('phone_number').unique(),
    phoneNumberVerified: boolean('phone_number_verified').default(false),
    twoFactorEnabled: boolean('two_factor_enabled').default(false),
  },
  (table) => [
    index('idx_user_email').on(table.email),
    index('idx_user_username').on(table.username),
    index('idx_user_phone_number').on(table.phoneNumber),
  ],
);

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
