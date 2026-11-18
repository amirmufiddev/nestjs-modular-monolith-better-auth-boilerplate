import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule, getSharedPool } from './database.module';
import { PG_POOL, DRIZZLE } from './database.constants';

jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

jest.mock('../config/env.validation', () => ({
  env: {
    DATABASE_URL: 'postgres://localhost:5432/test',
  },
}));

describe('DatabaseModule', () => {
  let module: TestingModule;
  let pgPool: any;
  let drizzleDb: any;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    pgPool = module.get(PG_POOL);
    drizzleDb = module.get(DRIZZLE);
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide PG_POOL', () => {
    expect(pgPool).toBeDefined();
  });

  it('should provide DRIZZLE', () => {
    expect(drizzleDb).toBeDefined();
  });

  it('should return a singleton pool', () => {
    const pool1 = getSharedPool();
    const pool2 = getSharedPool();
    expect(pool1).toBe(pool2);
  });
});
