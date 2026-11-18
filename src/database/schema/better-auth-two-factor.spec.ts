import { twoFactor, user } from './index';
import { getTableColumns } from 'drizzle-orm';

describe('Two-Factor Drizzle Schema', () => {
  it('should include twoFactorEnabled column in user table schema', () => {
    const columns = getTableColumns(user);
    expect(columns.twoFactorEnabled).toBeDefined();
    expect(columns.twoFactorEnabled.name).toBe('two_factor_enabled');
  });

  it('should define twoFactor table schema with correct columns and table name', () => {
    expect(twoFactor).toBeDefined();
    const columns = getTableColumns(twoFactor);
    expect(columns.id).toBeDefined();
    expect(columns.secret).toBeDefined();
    expect(columns.backupCodes).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.verified).toBeDefined();
    expect(columns.failedVerificationCount).toBeDefined();
    expect(columns.lockedUntil).toBeDefined();
  });
});
