import { describe, expect, it, mock } from 'bun:test';
import { getAdminSeedConfig, adminSeeder } from './admin.seed';
import * as argon2 from 'argon2';

describe('Admin Seeder', () => {
  it('should return env overrides or default values in getAdminSeedConfig', () => {
    const config = getAdminSeedConfig();
    expect(config.email).toBeTruthy();
    expect(config.password).toBeTruthy();
    expect(config.name).toBeTruthy();
    expect(config.username).toBeTruthy();
    expect(config.phoneNumber).toBeTruthy();
  });

  it('should skip run when admin user already exists', async () => {
    const executedQueries: string[] = [];
    const queryMock = mock((sql: string) => {
      executedQueries.push(sql);
      if (sql.includes('SELECT "id" FROM "user" WHERE "email" = $1')) {
        return Promise.resolve({ rows: [{ id: 'existing-admin-id' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const fakePool = { query: queryMock } as unknown as any;
    const fakeContext = { db: {} as any, pool: fakePool };

    await adminSeeder.run(fakeContext);

    expect(executedQueries.some((q) => q.includes('INSERT INTO "user"'))).toBe(
      false,
    );
    expect(
      executedQueries.some((q) => q.includes('INSERT INTO "account"')),
    ).toBe(false);
  });

  it('should create user and account with hashed password when admin user does not exist', async () => {
    let insertedPasswordHash = '';
    const clientQueryMock = mock((sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO "account"')) {
        insertedPasswordHash = params?.[3];
      }
      return Promise.resolve({ rows: [] });
    });

    const fakeClient = {
      query: clientQueryMock,
      release: mock(() => {}),
    };

    const poolQueryMock = mock((sql: string) => {
      if (sql.includes('SELECT "id" FROM "user" WHERE "email" = $1')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const fakePool = {
      query: poolQueryMock,
      connect: mock(() => Promise.resolve(fakeClient)),
    } as unknown as any;

    const fakeContext = { db: {} as any, pool: fakePool };

    await adminSeeder.run(fakeContext);

    expect(
      clientQueryMock.mock.calls.some(([sql]: [string]) =>
        sql.includes('INSERT INTO "user"'),
      ),
    ).toBe(true);
    expect(
      clientQueryMock.mock.calls.some(([sql]: [string]) =>
        sql.includes('INSERT INTO "account"'),
      ),
    ).toBe(true);
    expect(insertedPasswordHash).toBeTruthy();

    const config = getAdminSeedConfig();
    const isPasswordValid = await argon2.verify(
      insertedPasswordHash,
      config.password,
    );
    expect(isPasswordValid).toBe(true);
  });
});
