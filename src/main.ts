import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { env } from './config/env.validation';
import { configureStatic } from './bootstrap/static.config';
import { configureCors } from './bootstrap/cors.config';
import { configureCompress } from './bootstrap/compress.config';
import { configureHelmet } from './bootstrap/helmet.config';
import { configureMultipart } from './bootstrap/multipart.config';
import { configureRateLimit } from './bootstrap/rate-limit.config';
import { configureOpenApi } from './bootstrap/openapi.config';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from './logger/logger.service';
import { RlsInterceptor } from './shared/database/rls.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: true,
    }),
    {
      rawBody: true,
    },
  );
  const config = app.get(ConfigService);
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  app.useWebSocketAdapter(new IoAdapter(app));

  // Versioning: /api/v1/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  configureCors(app, config);
  await configureHelmet(app);
  await configureCompress(app, config);
  await configureRateLimit(app, config);
  await configureMultipart(app, config);
  await configureStatic(app, config);
  if (config.get<string>('app.nodeEnv') === 'development') {
    await configureOpenApi(app, config, logger);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new RlsInterceptor());
  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((err) => {
  const logger = new AppLoggerService();
  logger.error('Error bootstrapping application:', err);
  process.exit(1);
});
