import { createAuthInstance } from './auth';
import type { ConfigService } from '@nestjs/config';
import { getTableColumns } from 'drizzle-orm';
import { invitation } from '@/database/schema';

describe('auth factory', () => {
  const createMockConfig = () =>
    ({
      get: jest.fn((key: string) => {
        if (key === 'app') {
          return {
            appName: 'MyApp',
            appVersion: '1.0.0',
            baseUrl: 'http://localhost:2001',
            corsOrigins: ['http://localhost:3000'],
            fallbackLanguage: 'id',
          };
        }
        if (key === 'auth') {
          return {
            url: 'http://localhost:2001',
            secret: 'test-secret-min-32-chars-here-for-testing-only',
            path: '/v1/auth',
            google: { clientId: '', clientSecret: '' },
            useSecureCookies: false,
            errorURL: '/error',
            session: {
              expiresIn: 60,
              updateAge: 30,
              cookieCache: { enabled: true, maxAge: 60 },
            },
            membershipLimit: 10,
            organizationLimit: 5,
            invitationExpiresIn: 86400,
            inviteURL: 'http://localhost:3000/invite',
          };
        }
        return undefined;
      }),
    }) as unknown as ConfigService;
  it('should expose the invitation creation timestamp required by Better Auth', () => {
    const columns = getTableColumns(invitation);

    expect(columns.createdAt).toBeDefined();
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.createdAt.hasDefault).toBe(true);
  });

  it('should export createAuthInstance function', () => {
    expect(typeof createAuthInstance).toBe('function');
  });

  it('should instantiate betterAuth instance when deps are provided', () => {
    const mockConfig = createMockConfig();

    const instance = createAuthInstance({
      configService: mockConfig,
    });

    expect(instance).toBeDefined();
    expect(instance.options).toBeDefined();
    expect(instance.options.appName).toBe('MyApp');
  });

  it('should register twoFactor plugin with appName as issuer', () => {
    const mockConfig = createMockConfig();
    const instance = createAuthInstance({
      configService: mockConfig,
    });

    const options = instance.options;
    const twoFactorPlugin = options.plugins?.find(
      (p: any) => p.id === 'two-factor' || p.id === 'twoFactor',
    ) as any;
    expect(twoFactorPlugin).toBeDefined();
    expect(twoFactorPlugin.options?.issuer).toBe('MyApp');
  });

  it('should trigger emailService.send on sendResetPassword', async () => {
    const mockConfig = createMockConfig();

    const mockEmailService = {
      send: jest.fn().mockResolvedValue('msg-id-123'),
    } as any;

    const instance = createAuthInstance({
      configService: mockConfig,
      emailService: mockEmailService,
    });

    const options = instance.options;
    expect(options.emailAndPassword?.sendResetPassword).toBeDefined();

    await options.emailAndPassword?.sendResetPassword?.({
      user: { id: '1', email: 'user@example.com', name: 'User Test' } as any,
      url: 'http://localhost:2000/reset-password?token=abc',
      token: 'abc',
    });

    expect(mockEmailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: '[MyApp] Reset Kata Sandi Akun Anda',
        html: expect.stringContaining('Reset Kata Sandi'),
      }),
    );
    const sendArgs = mockEmailService.send.mock.calls[0][0];
    expect(sendArgs.html).toContain(
      'http://localhost:2000/reset-password?token=abc',
    );
  });

  it('should trigger emailService.send on sendVerificationEmail', async () => {
    const mockConfig = createMockConfig();

    const mockEmailService = {
      send: jest.fn().mockResolvedValue('msg-id-456'),
    } as any;

    const instance = createAuthInstance({
      configService: mockConfig,
      emailService: mockEmailService,
    });

    const options = instance.options;
    expect(options.emailVerification?.sendVerificationEmail).toBeDefined();

    await options.emailVerification?.sendVerificationEmail?.({
      user: { id: '1', email: 'user@example.com', name: 'User Test' } as any,
      url: 'http://localhost:2000/verify-email?token=xyz',
      token: 'xyz',
    });

    expect(mockEmailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: '[MyApp] Verifikasi Alamat Email Anda',
        html: expect.stringContaining('Verifikasi Email'),
      }),
    );
    const sendArgs = mockEmailService.send.mock.calls[0][0];
    expect(sendArgs.html).toContain(
      'http://localhost:2000/verify-email?token=xyz',
    );
  });

  it('should trigger emailService.send on sendInvitationEmail', async () => {
    const mockConfig = createMockConfig();

    const mockEmailService = {
      send: jest.fn().mockResolvedValue('msg-id-789'),
    } as any;

    const instance = createAuthInstance({
      configService: mockConfig,
      emailService: mockEmailService,
    });

    const options = instance.options;
    const orgPlugin = options.plugins?.find(
      (p: any) => p.id === 'organization',
    ) as any;
    expect(orgPlugin?.options?.sendInvitationEmail).toBeDefined();

    await orgPlugin?.options?.sendInvitationEmail?.({
      id: 'inv-123',
      email: 'member@example.com',
      role: 'member',
      inviter: {
        user: { name: 'Owner Name', email: 'owner@example.com' },
      },
      organization: {
        name: 'Acme Org',
        logo: '/uploads/public/org-1/logo.png',
      },
    });

    expect(mockEmailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'member@example.com',
        subject: '[MyApp] Undangan Bergabung dengan Organisasi Acme Org',
      }),
    );
    const sendArgs = mockEmailService.send.mock.calls[0][0];
    expect(sendArgs.html).toContain('Terima Undangan');
    expect(sendArgs.html).toContain('Acme Org');
    expect(sendArgs.html).toContain('Owner Name');
    expect(sendArgs.html).toContain(
      'http://localhost:2001/uploads/public/org-1/logo.png',
    );
  });

  it('should restrict organization creation to a membership callback', () => {
    const mockConfig = createMockConfig();
    const instance = createAuthInstance({
      configService: mockConfig,
    });

    const orgPlugin = instance.options.plugins?.find(
      (p: { id?: string }) => p.id === 'organization',
    ) as { options?: { allowUserToCreateOrganization?: unknown } } | undefined;

    expect(typeof orgPlugin?.options?.allowUserToCreateOrganization).toBe(
      'function',
    );
  });

  it('should trust Google as an account-linking provider', () => {
    const mockConfig = createMockConfig();
    const instance = createAuthInstance({
      configService: mockConfig,
    });

    expect(instance.options.account?.accountLinking?.enabled).not.toBe(false);
    expect(instance.options.account?.accountLinking?.trustedProviders).toEqual(
      expect.arrayContaining(['google']),
    );
    expect(
      instance.options.account?.accountLinking?.requireLocalEmailVerified,
    ).toBe(false);
  });

  it('should maintain backward compatible auth instance', () => {
    const mockConfig = createMockConfig();
    const instance = createAuthInstance({
      configService: mockConfig,
    });
    expect(instance).toBeDefined();
    expect(instance.api).toBeDefined();
  });

  it('should translate error messages using i18n plugin when error occurs', async () => {
    const mockConfig = createMockConfig();
    const instance = createAuthInstance({
      configService: mockConfig,
    });

    const req = new Request('http://localhost:2001/v1/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: '', password: '' }),
    });

    const res = await instance.handler(req);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        code: 'INVALID_EMAIL',
        message: 'Email tidak valid',
      }),
    );
  });
});
