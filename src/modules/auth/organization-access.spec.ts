import { canCreateOrganization } from './organization-access';

describe('canCreateOrganization', () => {
  it('should allow a user with no memberships to create an organization', () => {
    expect(canCreateOrganization([])).toBe(true);
  });

  it('should allow a user who is owner of at least one organization', () => {
    expect(canCreateOrganization(['driver', 'owner'])).toBe(true);
    expect(canCreateOrganization(['owner'])).toBe(true);
  });

  it('should reject admin, driver, and member without an owner membership', () => {
    expect(canCreateOrganization(['admin'])).toBe(false);
    expect(canCreateOrganization(['driver'])).toBe(false);
    expect(canCreateOrganization(['member'])).toBe(false);
    expect(canCreateOrganization(['admin', 'driver'])).toBe(false);
  });
});
