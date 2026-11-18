import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DriverTokenRepository } from './driver-token.repository';
import { pushTokens } from '@/shared/push-notification/schema/push-tokens.schema';

function makeSelectChain<T>(rows: T[] = []) {
  const chain: any = {
    from: mock(() => chain),
    where: mock(() => chain),
    execute: mock(() => Promise.resolve(rows)),
  };
  return chain;
}

describe('DriverTokenRepository', () => {
  let repo: DriverTokenRepository;
  let db: any;

  beforeEach(() => {
    db = { select: mock(), insert: mock(), update: mock() };
    repo = new DriverTokenRepository(db);
  });

  test('save upserts by fcm token', async () => {
    const chain: any = {
      values: mock(() => chain),
      onConflictDoUpdate: mock(() => Promise.resolve()),
    };
    db.insert.mockReturnValue(chain);

    await repo.save({
      userId: 'u1',
      fcmToken: 'tok',
      devicePlatform: 'web',
      lastSeenAt: new Date(),
    });

    expect(db.insert).toHaveBeenCalledWith(pushTokens);
    expect(chain.values).toHaveBeenCalled();
    expect(chain.onConflictDoUpdate).toHaveBeenCalled();
    const conflictArgs = chain.onConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflictArgs.target).toBe(pushTokens.fcmToken);
  });

  test('findByUserId filters out soft-deleted rows (deletedAt IS NULL)', async () => {
    const chain = makeSelectChain([]);
    db.select.mockReturnValue(chain);

    await repo.findByUserId('u1');

    const whereClause = chain.where.mock.calls[0]?.[0] as SQL;
    const query = new PgDialect().sqlToQuery(whereClause);
    expect(query.sql).toContain('"push_tokens"."deleted_at" is null');
    expect(query.sql).toContain('"push_tokens"."user_id" = $1');
    expect(query.params).toEqual(['u1']);
  });

  test('findByUserId maps platform column to devicePlatform', async () => {
    const lastSeenAt = new Date('2026-08-31T00:00:00.000Z');
    const chain = makeSelectChain([
      {
        userId: 'u1',
        fcmToken: 'tok',
        platform: 'web',
        lastSeenAt,
        deletedAt: null,
      },
    ]);
    db.select.mockReturnValue(chain);

    const result = await repo.findByUserId('u1');
    expect(result).toEqual([
      {
        userId: 'u1',
        fcmToken: 'tok',
        devicePlatform: 'web',
        lastSeenAt,
      },
    ]);
  });

  test('delete soft-deletes by fcm token', async () => {
    const chain: any = {
      set: mock(() => chain),
      where: mock(() => Promise.resolve()),
    };
    db.update.mockReturnValue(chain);

    await repo.delete('tok');

    expect(db.update).toHaveBeenCalledWith(pushTokens);
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  test('deleteForUser soft-deletes only when userId and fcmToken match active row', async () => {
    const chain: any = {
      set: mock(() => chain),
      where: mock(() => Promise.resolve()),
    };
    db.update.mockReturnValue(chain);

    await repo.deleteForUser('u1', 'tok');

    expect(db.update).toHaveBeenCalledWith(pushTokens);
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
    const whereClause = chain.where.mock.calls[0]?.[0] as SQL;
    const query = new PgDialect().sqlToQuery(whereClause);
    expect(query.sql).toContain('"push_tokens"."fcm_token" = $1');
    expect(query.sql).toContain('"push_tokens"."user_id" = $2');
    expect(query.sql).toContain('"push_tokens"."deleted_at" is null');
    expect(query.params).toEqual(['tok', 'u1']);
  });
});
