import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { registerFastifyPlugin } from './plugin-register.util';

export async function configureRateLimit(
  app: NestFastifyApplication,
  config: ConfigService,
): Promise<void> {
  const enabled = config.get<boolean>('rateLimit.enabled') ?? true;
  if (!enabled) {
    return;
  }

  const max = config.get<number>('rateLimit.max') ?? 100;
  const timeWindow = config.get<string>('rateLimit.timeWindow') ?? '1 minute';

  await registerFastifyPlugin(app, fastifyRateLimit, {
    max,
    timeWindow,
  });
}
