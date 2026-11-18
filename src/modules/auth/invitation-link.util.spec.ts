import { buildInvitationLink } from './invitation-link.util';

test('builds invite URL with invitation id', () => {
  expect(
    buildInvitationLink({
      invitationId: 'inv-2',
      inviteURL: 'http://admin.test/accept-invite',
    }),
  ).toBe('http://admin.test/accept-invite/inv-2');
});
