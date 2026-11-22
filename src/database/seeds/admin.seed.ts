import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import type { Seeder, SeederContext } from './seeder.interface';

export interface AdminSeedConfig {
  email: string;
  password: string;
  name: string;
  username: string;
  phoneNumber: string;
}

export function getAdminSeedConfig(): AdminSeedConfig {
  return {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin12345!',
    name: process.env.SEED_ADMIN_NAME || 'Super Admin',
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    phoneNumber: process.env.SEED_ADMIN_PHONE || '+6281234567890',
  };
}

export const adminSeeder: Seeder = {
  name: 'admin',
  async run({ pool }: SeederContext): Promise<void> {
    const config = getAdminSeedConfig();

    const existingUserResult = await pool.query<{ id: string }>(
      `SELECT "id" FROM "user" WHERE "email" = $1 LIMIT 1;`,
      [config.email],
    );

    if (existingUserResult.rows.length > 0) {
      console.log(
        `[admin] User with email "${config.email}" already exists. Skipping.`,
      );
      return;
    }

    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const hashedPassword = await argon2.hash(config.password);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        INSERT INTO "user" (
          "id",
          "name",
          "email",
          "email_verified",
          "role",
          "username",
          "display_username",
          "phone_number",
          "phone_number_verified",
          "created_at",
          "updated_at"
        )
        VALUES ($1, $2, $3, true, 'admin', $4, $4, $5, true, now(), now());
        `,
        [
          userId,
          config.name,
          config.email,
          config.username,
          config.phoneNumber,
        ],
      );

      await client.query(
        `
        INSERT INTO "account" (
          "id",
          "account_id",
          "provider_id",
          "user_id",
          "password",
          "created_at",
          "updated_at"
        )
        VALUES ($1, $2, 'credential', $3, $4, now(), now());
        `,
        [accountId, userId, userId, hashedPassword],
      );

      await client.query('COMMIT');
      console.log(`[admin] User admin "${config.email}" successfully created.`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
};
