import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCompress from '@fastify/compress';
import { registerFastifyPlugin } from './plugin-register.util';

export async function configureCompress(
  app: NestFastifyApplication,
  config: ConfigService,
): Promise<void> {
  const enabled = config.get<boolean>('compress.enabled') ?? true;
  if (!enabled) {
    return;
  }

  const encodings = config.get<string[]>('compress.encodings') ?? [
    'gzip',
    'deflate',
    'br',
  ];

  await registerFastifyPlugin(app, fastifyCompress, {
    encodings,
  });
}
