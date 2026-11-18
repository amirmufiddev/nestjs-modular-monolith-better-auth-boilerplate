import { organizationRoom } from '../realtime.constants';

describe('Realtime constants (boilerplate)', () => {
  it('should use org-prefixed websocket rooms', () => {
    expect(organizationRoom('abc')).toBe('org:abc');
  });
});
