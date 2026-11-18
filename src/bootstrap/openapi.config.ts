import { type Auth } from '@/modules/auth/auth';
import { AppLoggerService } from '@/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { mergeOpenAPISpecs } from '../utils/openapi-merger.util';
import { apiReference } from '@scalar/nestjs-api-reference';

export async function configureOpenApi(
  app: NestFastifyApplication,
  config: ConfigService,
  logger: AppLoggerService,
): Promise<void> {
  const baseUrl = config.get<string>('app.baseUrl') ?? '';

  const customSpec = new DocumentBuilder()
    .setTitle('NestJS Boilerplate API')
    .setDescription('Modular monolith REST API boilerplate')
    .setVersion(config.get<string>('API_VERSION') ?? '0.0.1')
    .addBearerAuth()
    .build();

  const customDocument = SwaggerModule.createDocument(app, customSpec);

  let betterAuthSpec: OpenAPIObject | null = null;
  try {
    const authService = app.get<AuthService<Auth>>(AuthService);
    // Cast required: Better Auth's internal API structure not fully typed in public interface
    const api = (
      authService as unknown as {
        api: { generateOpenAPISchema(): Promise<OpenAPIObject> };
      }
    ).api;
    if (typeof api?.generateOpenAPISchema === 'function') {
      betterAuthSpec = await api.generateOpenAPISchema();
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);
    logger.warn(
      `Could not fetch Better Auth OpenAPI spec, serving custom docs only: ${message}`,
      'Swagger',
    );
  }

  const mergedDocument = betterAuthSpec
    ? mergeOpenAPISpecs(betterAuthSpec, customDocument, {
        betterAuthTagPrefix: 'Auth',
      })
    : customDocument;

  mergedDocument.servers = baseUrl ? [{ url: baseUrl }] : [];

  // Expose raw OpenAPI JSON for curl, CI, and Scalar docs:deploy script.
  const instance = app.getHttpAdapter().getInstance();
  instance.get(
    '/docs-json',
    (
      _req: unknown,
      reply: { type: (t: string) => { send: (d: unknown) => void } },
    ) => {
      reply.type('application/json').send(mergedDocument);
    },
  );
  app.use(
    '/docs',
    apiReference({
      content: mergedDocument,
      withFastify: true, // Required when using Fastify adapter
    }),
  );
}
