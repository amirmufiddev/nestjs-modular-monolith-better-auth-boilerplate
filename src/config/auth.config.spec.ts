import { authConfig } from './auth.config';

describe('auth invite urls', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should build inviteURL from client URL and invite path', () => {
    process.env.BETTER_AUTH_CLIENT_URL = 'http://localhost:2000';
    process.env.BETTER_AUTH_INVITE_PATH = '/auth/accept-invitation';
    process.env.BETTER_AUTH_ERROR_PATH = '/auth/error';
    process.env.NODE_ENV = 'development';

    const config = authConfig();

    expect(config.inviteURL).toBe(
      'http://localhost:2000/auth/accept-invitation',
    );
  });
});
