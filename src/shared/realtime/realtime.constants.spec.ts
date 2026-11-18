import { organizationRoom, userRoom } from './realtime.constants';

describe('realtime.constants', () => {
  it('should prefix organization id in organizationRoom', () => {
    expect(organizationRoom('org-uuid')).toBe('org:org-uuid');
  });

  it('should prefix user id in userRoom', () => {
    expect(userRoom('user-uuid')).toBe('user:user-uuid');
  });
});
