import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import { registerFastifyPlugin } from './plugin-register.util';

export async function configureMultipart(
  app: NestFastifyApplication,
  config: ConfigService,
): Promise<void> {
  const fileSize = config.get<number>('upload.maxSize') ?? 10 * 1024 * 1024;
  const files = config.get<number>('upload.maxFiles') ?? 5;

  await registerFastifyPlugin(app, fastifyMultipart, {
    limits: {
      fileSize,
      files,
    },
  });
}
