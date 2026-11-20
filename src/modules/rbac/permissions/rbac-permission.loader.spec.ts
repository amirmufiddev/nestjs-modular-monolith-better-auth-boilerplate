import { describe, expect, it } from 'bun:test';
import { loadBetterAuthStatement } from './rbac-permission.loader';
import { BOOTSTRAP_BETTER_AUTH_STATEMENT } from '../constants/permissions.constant';

describe('loadBetterAuthStatement', () => {
  it('should fall back to bootstrap when rbac_permission table is missing', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.reject({
              cause: { code: '42P01' },
            }),
        }),
      }),
    };

    const statement = await loadBetterAuthStatement(db as never);
    expect(statement).toEqual(BOOTSTRAP_BETTER_AUTH_STATEMENT);
  });
});
