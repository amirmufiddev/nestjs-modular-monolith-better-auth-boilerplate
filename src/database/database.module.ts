import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.validation';
import { PG_POOL, DRIZZLE } from './database.constants';

let sharedPool: Pool;
export function getSharedPool() {
  if (!sharedPool) {
    sharedPool = new Pool({ connectionString: env.DATABASE_URL });
  }
  return sharedPool;
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => getSharedPool(),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => drizzle(pool),
    },
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DatabaseModule {}
