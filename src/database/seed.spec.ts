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
  it('ensureSeedsTable should create _seeds table if not exists', async () => {
    const queryMock = mock(() => Promise.resolve({ rows: [] }));
    const fakePool = { query: queryMock } as unknown as any;

    await ensureSeedsTable(fakePool);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS "_seeds"');
  });

  it('getExecutedSeeds should return a set of executed seed names', async () => {
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

  it('getNextBatchNumber should return 1 when table is empty or max is null', async () => {
    const queryMock = mock(() =>
      Promise.resolve({
        rows: [{ max_batch: null }],
      }),
    );
    const fakePool = { query: queryMock } as unknown as any;

    const batch = await getNextBatchNumber(fakePool);
    expect(batch).toBe(1);
  });

  it('recordExecutedSeed should insert seed name and batch into _seeds', async () => {
    const queryMock = mock(() => Promise.resolve({ rows: [] }));
    const fakePool = { query: queryMock } as unknown as any;

    await recordExecutedSeed(fakePool, 'rbac', 2);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "_seeds"'),
      ['rbac', 2],
    );
  });

  it('runSeeders should skip already executed seeders when force is false', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: async () => {
        executedLogs.push('rbac');
      },
    };
    const seeder2: Seeder = {
      name: 'admin',
      run: async () => {
        executedLogs.push('admin');
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

    const result = await runSeeders([seeder1, seeder2], { force: false }, fakeContext);

    expect(result.skipped).toEqual(['rbac']);
    expect(result.executed).toEqual(['admin']);
    expect(executedLogs).toEqual(['admin']);
  });

  it('runSeeders should re-run executed seeders when force is true', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: async () => {
        executedLogs.push('rbac');
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

  it('runSeeders should only run targeted seeder when target option is specified', async () => {
    const executedLogs: string[] = [];
    const seeder1: Seeder = {
      name: 'rbac',
      run: async () => {
        executedLogs.push('rbac');
      },
    };
    const seeder2: Seeder = {
      name: 'admin',
      run: async () => {
        executedLogs.push('admin');
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

    const result = await runSeeders([seeder1, seeder2], { target: 'admin' }, fakeContext);

    expect(result.executed).toEqual(['admin']);
    expect(executedLogs).toEqual(['admin']);
  });
});
