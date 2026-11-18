import { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * Fastify's `register` overload is contravariant in `instance` — each
 * plugin narrows the expected decorations which the `app.register()` typing
 * cannot statically unify across plugins. This helper encapsulates the
 * `as never` cast to keep plugin configuration files clean and ergonomic.
 *
 * ponytail: Minimal helper encapsulating Fastify plugin registration typing variance.
 */
export async function registerFastifyPlugin<T = Record<string, unknown>>(
  app: NestFastifyApplication,
  plugin: unknown,
  options?: T,
): Promise<void> {
  await app.register(plugin as never, options as never);
}
