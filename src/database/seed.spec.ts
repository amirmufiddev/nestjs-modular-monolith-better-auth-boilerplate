import { describe, expect, it, mock } from 'bun:test';
import type { Seeder, SeederContext } from './seeds/seeder.interface';
import {
  ensureSeedsTable,
  getExecutedSeeds,
  getNextBatchNumber,
  recordExecutedSeed,
  runSeeders,
} from './seed';

describe('Seed Runner Core', () => {
  it('should create _seeds table if not exists in ensureSeedsTable', async () => {
    const queryMock = mock(() => Promise.resolve({ rows: [] }));
    const fakePool = { query: queryMock } as unknown as any;

    await ensureSeedsTable(fakePool);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain(
      'CREATE TABLE IF NOT EXISTS "_seeds"',
    );
  });

  it('should return a set of executed seed names in getExecutedSeeds', async () => {
    const queryMock = mock(() =>
      Promise.resolve({
        rows: [{ name: 'rbac' }, { name: 'admin' }],
      }),
    );
    const fakePool = { query: queryMock } as unknown as any;

    const result = await getExecutedSeeds(fakePool);

    expect(result.has('rbac')).toBe(true);
    expect(result.has('admin')).toBe(true);
    expect(result.has('regional')).toBe(false);
  });

  it('should return 1 when table is empty or max is null in getNextBatchNumber', async () => {
    const queryMock = mock(() =>
      Promise.resolve({
        rows: [{ max_batch: null }],
      }),
    );
    const fakePool = { query: queryMock } as unknown as any;

    const batch = await getNextBatchNumber(fakePool);
    expect(batch).toBe(1);
  });

  it('should insert seed name and batch into _seeds in recordExecutedSeed', async () => {
    const queryMock = mock(() => Promise.resolve({ rows: [] }));
    const fakePool = { query: queryMock } as unknown as any;

    await recordExecutedSeed(fakePool, 'rbac', 2);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "_seeds"'),
      ['rbac', 2],
    );
  });

  it('should skip already executed seeders when force is false in runSeeders', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: () => {
        executedLogs.push('rbac');
        return Promise.resolve();
      },
    };
    const seeder2: Seeder = {
      name: 'admin',
      run: () => {
        executedLogs.push('admin');
        return Promise.resolve();
      },
    };

    const queryMock = mock((sql: string) => {
      if (sql.includes('SELECT name FROM "_seeds"')) {
        return Promise.resolve({ rows: [{ name: 'rbac' }] });
      }
      if (sql.includes('SELECT COALESCE(MAX(batch), 0)')) {
        return Promise.resolve({ rows: [{ max_batch: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext: SeederContext = { db: {} as any, pool: fakePool };

    const result = await runSeeders(
      [seeder1, seeder2],
      { force: false },
      fakeContext,
    );

    expect(result.skipped).toEqual(['rbac']);
    expect(result.executed).toEqual(['admin']);
    expect(executedLogs).toEqual(['admin']);
  });

  it('should re-run executed seeders when force is true in runSeeders', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: () => {
        executedLogs.push('rbac');
        return Promise.resolve();
      },
    };

    const queryMock = mock((sql: string) => {
      if (sql.includes('SELECT name FROM "_seeds"')) {
        return Promise.resolve({ rows: [{ name: 'rbac' }] });
      }
      if (sql.includes('SELECT COALESCE(MAX(batch), 0)')) {
        return Promise.resolve({ rows: [{ max_batch: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext: SeederContext = { db: {} as any, pool: fakePool };

    const result = await runSeeders([seeder1], { force: true }, fakeContext);

    expect(result.skipped).toEqual([]);
    expect(result.executed).toEqual(['rbac']);
    expect(executedLogs).toEqual(['rbac']);
  });

  it('should only run targeted seeder when target option is specified in runSeeders', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: () => {
        executedLogs.push('rbac');
        return Promise.resolve();
      },
    };
    const seeder2: Seeder = {
      name: 'admin',
      run: () => {
        executedLogs.push('admin');
        return Promise.resolve();
      },
    };

    const queryMock = mock((sql: string) => {
      if (sql.includes('SELECT name FROM "_seeds"')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT COALESCE(MAX(batch), 0)')) {
        return Promise.resolve({ rows: [{ max_batch: 0 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext: SeederContext = { db: {} as any, pool: fakePool };

    const result = await runSeeders(
      [seeder1, seeder2],
      { target: 'admin' },
      fakeContext,
    );

    expect(result.executed).toEqual(['admin']);
    expect(executedLogs).toEqual(['admin']);
  });
});

describe('defaultSeeders registry', () => {
  it('should contain rbac, admin, and regional seeders in correct order', async () => {
    const { defaultSeeders } = await import('./seed');
    expect(defaultSeeders).toBeDefined();
    const names = defaultSeeders.map((s) => s.name);
    expect(names).toEqual(['rbac', 'admin', 'regional']);
  });
});
