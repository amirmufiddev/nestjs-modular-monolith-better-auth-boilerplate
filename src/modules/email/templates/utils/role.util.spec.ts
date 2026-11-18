import { humanizeRole } from './role.util';

describe('humanizeRole', () => {
  it('should humanize kebab and snake case roles', () => {
    expect(humanizeRole('member')).toBe('Member');
    expect(humanizeRole('org_admin')).toBe('Org Admin');
    expect(humanizeRole('super-admin')).toBe('Super Admin');
  });

  it('should fallback to Member for empty role', () => {
    expect(humanizeRole('')).toBe('Member');
    expect(humanizeRole('   ')).toBe('Member');
  });
});
