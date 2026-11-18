import { registerAs } from '@nestjs/config';
import { type EnvConfig, validatedEnv } from './env.validation';

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  from: string;
  fromName: string;
  replyTo: string | undefined;
  connectionTimeoutMs: number;
  greetingTimeoutMs: number;
  socketTimeoutMs: number;
  maxRecipientsPerJob: number;
  defaultSubjectPrefix: string;
}

export function buildEmailConfig(env: EnvConfig): EmailConfig {
  const replyTo = env.EMAIL_REPLY_TO.trim();
  return {
    enabled: env.EMAIL_ENABLED,
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: {
      user: env.EMAIL_USER ?? '',
      pass: env.EMAIL_PASSWORD ?? '',
    },
    from: env.EMAIL_FROM,
    fromName: env.EMAIL_FROM_NAME,
    replyTo: replyTo.length > 0 ? replyTo : undefined,
    connectionTimeoutMs: env.EMAIL_TIMEOUT_MS,
    greetingTimeoutMs: env.EMAIL_TIMEOUT_MS,
    socketTimeoutMs: env.EMAIL_TIMEOUT_MS,
    maxRecipientsPerJob: env.EMAIL_MAX_RECIPIENTS_PER_JOB,
    defaultSubjectPrefix: env.EMAIL_SUBJECT_PREFIX,
  };
}

export const emailConfig = registerAs('email', (): EmailConfig =>
  buildEmailConfig(validatedEnv),
);
