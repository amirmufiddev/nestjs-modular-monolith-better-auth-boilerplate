import { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import { registerFastifyPlugin } from './plugin-register.util';

export async function configureHelmet(
  app: NestFastifyApplication,
): Promise<void> {
  await registerFastifyPlugin(app, fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        // jsDelivr hosts the Scalar API Reference runtime (loaded by /docs).
        styleSrc: [`'self'`, `'unsafe-inline'`, 'https://cdn.jsdelivr.net'],
        scriptSrc: [
          `'self'`,
          `'unsafe-inline'`,
          `'unsafe-eval'`,
          'https://cdn.jsdelivr.net',
        ],
        imgSrc: [`'self'`, 'data:', 'blob:', 'https:'],
        // Scalar API Reference fetches the OpenAPI JSON from /docs-json.
        connectSrc: [`'self'`],
        fontSrc: [`'self'`, 'data:', 'https://cdn.jsdelivr.net'],
      },
    },
  });
}
