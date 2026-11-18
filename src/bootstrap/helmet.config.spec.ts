import { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import { configureHelmet } from './helmet.config';
import * as pluginRegisterUtil from './plugin-register.util';

describe('configureHelmet', () => {
  it('should register fastifyHelmet plugin with proper CSP directives', async () => {
    const registerSpy = jest
      .spyOn(pluginRegisterUtil, 'registerFastifyPlugin')
      .mockResolvedValue(undefined);

    const mockApp = {} as NestFastifyApplication;

    await configureHelmet(mockApp);

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(mockApp, fastifyHelmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdn.jsdelivr.net',
          ],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
        },
      },
    });

    registerSpy.mockRestore();
  });
});
