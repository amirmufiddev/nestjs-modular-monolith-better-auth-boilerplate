import * as schema from '@/database/schema';
import { APIError, betterAuth, type BetterAuthOptions } from 'better-auth';
import { setSessionCookie } from 'better-auth/cookies';
import { prepareWhatsappNumber } from '@/common/phone/phone.util';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAccessControl } from 'better-auth/plugins/access';
import {
  BOOTSTRAP_BETTER_AUTH_STATEMENT,
  getDefaultRolePermissions,
  getDefaultPermissionScopes,
} from '@/modules/rbac/constants/permissions.constant';
import { loadOrganizationRoleTemplates } from '@/modules/rbac/permissions/rbac-permission.loader';
import {
  admin,
  bearer,
  openAPI,
  organization,
  phoneNumber,
  twoFactor,
  username,
} from 'better-auth/plugins';
import { MemberAcceptedBridge } from '@/modules/member';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { canCreateOrganization } from '@/modules/auth/organization-access';
import { i18n } from '@better-auth/i18n';
import translationsId from '@/i18n/id/auth-errors.json';
import translationsEn from '@/i18n/en/auth-errors.json';
import { getSharedPool } from '@/database/database.module';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '@/logger/logger.service';
import {
  EmailService,
  buildResetPasswordEmail,
  buildEmailVerificationEmail,
  buildOrganizationInvitationEmail,
} from '@/modules/email';
import { AppConfig, AuthConfig } from '@/config';
import { buildInvitationLink } from '@/modules/auth/invitation-link.util';

import { EventEmitter2 } from '@nestjs/event-emitter';

export interface AuthDependencies {
  configService: ConfigService;
  emailService?: EmailService;
  loggerService?: AppLoggerService;
  secondaryStorage?: BetterAuthOptions['secondaryStorage'];
  eventEmitter?: EventEmitter2;
  betterAuthStatement?: Record<string, readonly string[]>;
}

const buildEmailAndPasswordConfig = (deps: AuthDependencies) => ({
  enabled: true,
  requireEmailVerification: false,
  minPasswordLength: 8,
  async sendResetPassword({
    user,
    url,
  }: {
    user: { name?: string | null; email?: string };
    url: string;
  }) {
    const { appName } = deps.configService.get<AppConfig>('app', {
      infer: true,
    });
    if (!deps.emailService || !user.email) return;
    const html = buildResetPasswordEmail({
      userName: user.name ?? 'Pengguna',
      resetUrl: url,
      appName,
    });
    await deps.emailService.send({
      to: user.email,
      subject: `[${appName}] Reset Kata Sandi Akun Anda`,
      html,
    });
  },
  password: {
    hash: async (password: string) => {
      const argon2 = await import('argon2');
      return await argon2.hash(password);
    },
    verify: async ({ password, hash }: { password: string; hash: string }) => {
      const argon2 = await import('argon2');
      return await argon2.verify(hash, password);
    },
  },
});

const buildEmailVerificationConfig = (deps: AuthDependencies) => ({
  sendVerificationEmail: async ({
    user,
    url,
  }: {
    user: { name?: string | null; email?: string };
    url: string;
  }) => {
    const { appName } = deps.configService.get<AppConfig>('app', {
      infer: true,
    });
    if (!deps.emailService || !user.email) return;
    const html = buildEmailVerificationEmail({
      userName: user.name ?? 'Pengguna',
      verificationUrl: url,
      appName,
    });
    await deps.emailService.send({
      to: user.email,
      subject: `[${appName}] Verifikasi Alamat Email Anda`,
      html,
    });
  },
});

const buildSocialProvidersConfig = (
  clientId: string,
  clientSecret: string,
) => ({
  google: {
    clientId,
    clientSecret,
    enabled: !!(clientId && clientSecret),
  },
});

const buildPluginsConfig = (
  deps: AuthDependencies,
  authDb: ReturnType<typeof drizzle>,
) => {
  const { appName, appVersion, fallbackLanguage, baseUrl } =
    deps.configService.get<AppConfig>('app', {
      infer: true,
    });
  const { membershipLimit, organizationLimit, invitationExpiresIn, inviteURL } =
    deps.configService.get<AuthConfig>('auth', {
      infer: true,
    });

  const statement = deps.betterAuthStatement ?? BOOTSTRAP_BETTER_AUTH_STATEMENT;
  const ac = createAccessControl(statement);

  return [
    bearer(),
    admin({
      ac,
      roles: {
        admin: ac.newRole({
          ...Object.fromEntries(
            Object.keys(statement).map((key) => [key, statement[key]]),
          ),
        }),
        user: ac.newRole({}),
      },
    }),
    username(),
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      phoneNumberValidator: (value) => prepareWhatsappNumber(value, true).ok,
      sendOTP: ({ phoneNumber: target, code }) => {
        const nodeEnv = deps.configService.get<AppConfig>('app', {
          infer: true,
        }).nodeEnv;
        deps.loggerService?.log(
          nodeEnv === 'production'
            ? `Kode verifikasi WhatsApp diminta untuk ${target}`
            : `Kode verifikasi WhatsApp untuk ${target}: ${code}`,
          'Auth',
        );
        return Promise.resolve();
      },
      callbackOnVerification: async ({ user }, ctx) => {
        const current = ctx?.context.session;
        if (!ctx || !current) return;
        await setSessionCookie(ctx, {
          session: current.session,
          user,
        });
      },
    }),
    twoFactor({
      issuer: appName,
    }),
    organization({
      ac,
      allowUserToCreateOrganization: async (user) => {
        const rows = await authDb
          .select({ role: schema.member.role })
          .from(schema.member)
          .where(eq(schema.member.userId, user.id));
        return canCreateOrganization(rows.map((row) => row.role));
      },
      organizationLimit: organizationLimit,
      creatorRole: 'owner',
      membershipLimit: membershipLimit,
      invitationExpiresIn: invitationExpiresIn,
      dynamicAccessControl: {
        enabled: true,
      },
      schema: {
        organizationRole: {
          additionalFields: {
            permissionScopes: {
              type: 'string',
              defaultValue: '{}',
            },
          },
        },
      },
      organizationHooks: {
        afterAcceptInvitation: async ({
          invitation: _invitation,
          member,
          user,
          organization,
        }) => {
          deps.eventEmitter?.emit('rbac.cache.invalidate', {
            orgId: organization.id,
            userId: user.id,
          });
          await MemberAcceptedBridge.handler?.({
            organizationId: organization.id,
            userId: user.id,
            email: user.email,
            name: user.name,
            phone: user.phoneNumber ?? null,
            role: member.role,
          });
        },
        afterAddMember: async ({ member, user, organization }) => {
          deps.eventEmitter?.emit('rbac.cache.invalidate', {
            orgId: organization.id,
            userId: user.id,
          });
          await MemberAcceptedBridge.handler?.({
            organizationId: organization.id,
            userId: user.id,
            email: user.email,
            name: user.name,
            phone: user.phoneNumber ?? null,
            role: member.role,
          });
        },
        afterCreateOrganization: async ({ organization }) => {
          const templates = await loadOrganizationRoleTemplates(authDb);

          const roleEntries =
            templates.length > 0
              ? templates.map((template) => ({
                  id: crypto.randomUUID(),
                  organizationId: organization.id,
                  role: template.roleName,
                  permission: template.permission,
                  permissionScopes: template.permissionScopes,
                  createdAt: new Date(),
                }))
              : Object.entries(getDefaultRolePermissions()).map(
                  ([role, permissions]) => ({
                    id: crypto.randomUUID(),
                    organizationId: organization.id,
                    role,
                    permission: JSON.stringify(permissions),
                    permissionScopes: JSON.stringify(
                      getDefaultPermissionScopes()[role] ?? {},
                    ),
                    createdAt: new Date(),
                  }),
                );

          await authDb
            .insert(schema.organizationRole)
            .values(roleEntries)
            .onConflictDoNothing();

          deps.loggerService?.log(
            `Created default roles for organization ${organization.id}: ${roleEntries.map((entry) => entry.role).join(', ')}`,
          );
        },
      },
      async sendInvitationEmail(data) {
        if (!deps.emailService) return;

        const inviteUrl = buildInvitationLink({
          invitationId: data.id,
          inviteURL,
        });
        const html = buildOrganizationInvitationEmail({
          inviterName: data.inviter.user.name ?? data.inviter.user.email,
          organizationName: data.organization.name,
          organizationLogo: data.organization.logo,
          role: data.role,
          inviteUrl,
          appName,
          baseUrl,
        });
        await deps.emailService.send({
          to: data.email,
          subject: `[${appName}] Undangan Bergabung dengan Organisasi ${data.organization.name}`,
          html,
        });
      },
    }),
    openAPI({
      enabled: true,
      path: '/api/docs',
      title: `${appName} API`,
      description: `${appName} API`,
      version: appVersion,
    }),
    i18n({
      defaultLocale: fallbackLanguage,
      detection: ['header', 'cookie'],
      localeCookie: 'locale',
      translations: {
        id: translationsId,
        en: translationsEn,
      },
    }),
  ];
};

function assignWhatsappNumber(
  user: Record<string, unknown>,
  required: boolean,
): void {
  const result = prepareWhatsappNumber(user.phoneNumber, required);
  if (result.ok === false) {
    throw new APIError('BAD_REQUEST', {
      message:
        result.reason === 'required'
          ? 'Nomor WhatsApp wajib diisi'
          : 'Nomor WhatsApp tidak valid',
    });
  }
  if (result.value) {
    user.phoneNumber = result.value;
  }
}

export const createAuthInstance = (deps: AuthDependencies) => {
  const { corsOrigins, appName } = deps.configService.get<AppConfig>('app', {
    infer: true,
  });
  const { url, secret, path, google, useSecureCookies, errorURL, session } =
    deps.configService.get<AuthConfig>('auth', {
      infer: true,
    });

  const authDb = drizzle({ client: getSharedPool(), schema: schema as any });

  const options: BetterAuthOptions = {
    appName,
    basePath: path,
    baseURL: url,
    secret,
    database: drizzleAdapter(authDb, { provider: 'pg', schema }),
    secondaryStorage: deps.secondaryStorage,
    user: {
      additionalFields: {
        phoneNumber: {
          type: 'string',
          required: false,
          defaultValue: null,
          input: true,
        },
      },
    },
    emailAndPassword: buildEmailAndPasswordConfig(deps),
    emailVerification: buildEmailVerificationConfig(deps),
    socialProviders: buildSocialProvidersConfig(
      google.clientId,
      google.clientSecret,
    ),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        requireLocalEmailVerified: false,
      },
    },
    session: {
      expiresIn: session.expiresIn,
      updateAge: session.updateAge,
      cookieCache: {
        enabled: session.cookieCache.enabled,
        maxAge: session.cookieCache.maxAge,
      },
    },
    plugins: buildPluginsConfig(deps, authDb) as any[],
    logger: {
      disabled: false,
      level: 'error',
      log: (level, message) => {
        if (deps.loggerService) {
          deps.loggerService.error(`BetterAuth [${level}]: ${message}`);
        }
      },
    },
    trustedOrigins: corsOrigins,
    advanced: {
      cookiePrefix: appName,
      useSecureCookies,
    },
    databaseHooks: {
      user: {
        create: {
          before: (user: Record<string, unknown>, context) => {
            const path = String(
              (context as { path?: string } | undefined)?.path ?? '',
            );
            const required = path.includes('sign-up');
            const hasPhone =
              typeof user.phoneNumber === 'string' &&
              user.phoneNumber.trim() !== '';
            if (required || hasPhone) {
              assignWhatsappNumber(user, required);
            }
            return Promise.resolve({ data: user });
          },
        },
        update: {
          before: (user: Record<string, unknown>) => {
            if ('phoneNumber' in user) {
              assignWhatsappNumber(user, true);
            }
            return Promise.resolve({ data: user });
          },
        },
      },
    },
    onAPIError: {
      errorURL,
    },
  };

  return betterAuth({
    ...options,
    plugins: [...(options.plugins ?? [])],
  });
};

export type Auth = ReturnType<typeof createAuthInstance>;
