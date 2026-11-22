import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export interface SeederContext {
  db: NodePgDatabase<Record<string, unknown>>;
  pool: Pool;
}

export interface Seeder {
  readonly name: string;
  run(context: SeederContext): Promise<void>;
}
