import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  url: string;
  secret: string;
  path: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  useSecureCookies: boolean;
  clientUrl: string;
  errorURL: string;
  inviteURL: string;
  organizationLimit?: number;
  membershipLimit?: number;
  invitationExpiresIn: number;
  session: {
    expiresIn: number;
    updateAge: number;
    cookieCache: {
      enabled: boolean;
      maxAge: number;
    };
  };
}

export const authConfig = registerAs('auth', (): AuthConfig => ({
  url: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  path: process.env.BETTER_AUTH_PATH,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  clientUrl: process.env.BETTER_AUTH_CLIENT_URL,
  errorURL: `${process.env.BETTER_AUTH_CLIENT_URL}${process.env.BETTER_AUTH_ERROR_PATH}`,
  inviteURL: `${process.env.BETTER_AUTH_CLIENT_URL}${process.env.BETTER_AUTH_INVITE_PATH}`,
  invitationExpiresIn: 60 * 60 * 48,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
}));
