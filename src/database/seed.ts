import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.validation';
import type { Seeder, SeederContext } from './seeds/seeder.interface';
import { rbacSeeder } from './seeds/rbac.seed';
import { adminSeeder } from './seeds/admin.seed';
import { regionalSeeder } from './seeds/regional.seed';

export const defaultSeeders: Seeder[] = [
  rbacSeeder,
  adminSeeder,
  regionalSeeder,
];

export interface RunSeedersOptions {
  force?: boolean;
  target?: string;
}

export async function ensureSeedsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "_seeds" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL UNIQUE,
      "batch" integer NOT NULL,
      "executed_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
}

export async function getExecutedSeeds(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM "_seeds" ORDER BY id ASC;`,
  );
  return new Set(result.rows.map((row) => row.name));
}

export async function getNextBatchNumber(pool: Pool): Promise<number> {
  const result = await pool.query<{ max_batch: number | null }>(
    `SELECT COALESCE(MAX(batch), 0) AS max_batch FROM "_seeds";`,
  );
  const currentMax = result.rows[0]?.max_batch ?? 0;
  return Number(currentMax) + 1;
}

export async function recordExecutedSeed(
  pool: Pool,
  name: string,
  batch: number,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO "_seeds" ("name", "batch", "executed_at")
    VALUES ($1, $2, now())
    ON CONFLICT ("name") DO UPDATE
      SET "batch" = EXCLUDED.batch,
          "executed_at" = EXCLUDED.executed_at;
    `,
    [name, batch],
  );
}

export async function runSeeders(
  seeders: Seeder[],
  options: RunSeedersOptions,
  context: SeederContext,
): Promise<{ executed: string[]; skipped: string[] }> {
  await ensureSeedsTable(context.pool);
  const executedSet = await getExecutedSeeds(context.pool);
  const nextBatch = await getNextBatchNumber(context.pool);

  const executed: string[] = [];
  const skipped: string[] = [];

  const candidateSeeders = options.target
    ? seeders.filter((s) => s.name === options.target)
    : seeders;

  if (options.target && candidateSeeders.length === 0) {
    throw new Error(`Seeder with name "${options.target}" not found.`);
  }

  for (const seeder of candidateSeeders) {
    const isAlreadyExecuted = executedSet.has(seeder.name);
    if (isAlreadyExecuted && !options.force) {
      console.log(`[skip] Seeder "${seeder.name}" has already been executed.`);
      skipped.push(seeder.name);
      continue;
    }

    console.log(`[start] Running seeder "${seeder.name}"...`);
    const startTime = Date.now();
    await seeder.run(context);
    await recordExecutedSeed(context.pool, seeder.name, nextBatch);
    const duration = Date.now() - startTime;
    console.log(`[done] Seeder "${seeder.name}" finished in ${duration}ms.`);
    executed.push(seeder.name);
  }

  return { executed, skipped };
}

export function parseCliArgs(argv: string[]): RunSeedersOptions {
  const args = argv.slice(2);
  const force = args.includes('--force');
  const target = args.find((arg) => !arg.startsWith('--'));
  return { force, target };
}

async function main() {
  const options = parseCliArgs(process.argv);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const seeders: Seeder[] = defaultSeeders;
    console.log('🌱 Starting database seeding...');
    const result = await runSeeders(seeders, options, { db, pool });
    console.log(
      `🎉 Seeding completed. Executed: ${result.executed.length}, Skipped: ${result.skipped.length}`,
    );
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module
) {
  void main().catch((err) => {
    console.error('Seed runner failed:', err);
    process.exit(1);
  });
} else if (
  process.argv[1]?.replace(/\\/g, '/').endsWith('src/database/seed.ts')
) {
  void main().catch((err) => {
    console.error('Seed runner failed:', err);
    process.exit(1);
  });
}
