import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';

function assertProductionCorsAllowed(
  nodeEnv: string | undefined,
  rawCorsOrigins: string | string[] | undefined,
): void {
  if (nodeEnv !== 'production') {
    return;
  }

  const hasWildcard =
    rawCorsOrigins === '*' ||
    (Array.isArray(rawCorsOrigins) && rawCorsOrigins.includes('*')) ||
    (typeof rawCorsOrigins === 'string' &&
      rawCorsOrigins
        .split(',')
        .map((s) => s.trim())
        .includes('*'));

  if (hasWildcard) {
    throw new Error('Wildcard origin (*) is not allowed in production');
  }
}

export function configureCors(
  app: NestFastifyApplication,
  config: ConfigService,
): void {
  const nodeEnv = config.get<string>('app.nodeEnv', { infer: true });
  const rawCorsOrigins = config.get('app.corsOrigins', { infer: true });

  assertProductionCorsAllowed(nodeEnv, rawCorsOrigins);

  // `app.corsOrigins` is registered by `appConfig` as a `string[]` or `string`
  // (comma-split in src/config/app.config.ts), but we still accept a
  // bare string for forward-compatibility with config values that come
  // from a raw env var.
  let origin: string | string[];
  if (Array.isArray(rawCorsOrigins)) {
    origin = rawCorsOrigins;
  } else if (typeof rawCorsOrigins === 'string') {
    if (rawCorsOrigins === '*') {
      origin = '*';
    } else {
      origin = rawCorsOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } else {
    origin = [];
  }

  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });
}
