import { registerAs } from '@nestjs/config';
import { type EnvConfig, validatedEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  appName: string;
  appVersion: string;
  corsOrigins: string[];
  fallbackLanguage: string;
  baseUrl: string;
}

function uniqueOrigins(values: string[]): string[] {
  const seen = new Set<string>();
  const origins: string[] = [];
  for (const value of values) {
    const origin = value.trim().replace(/\/$/, '');
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    origins.push(origin);
  }
  return origins;
}

export function buildAppConfig(env: EnvConfig): AppConfig {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    appName: env.APP_NAME,
    appVersion: env.APP_VERSION,
    corsOrigins: uniqueOrigins([...env.CORS_ORIGINS.split(',')]),
    fallbackLanguage: env.FALLBACK_LANGUAGE,
    baseUrl: env.BASE_URL,
  };
}

export const appConfig = registerAs('app', (): AppConfig =>
  buildAppConfig(validatedEnv),
);
