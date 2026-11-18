import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisStorage } from '@better-auth/redis-storage';
import { AppLoggerService } from '@/logger/logger.service';
import {
  BETTER_AUTH_REDIS_DEFAULT_DB,
  BETTER_AUTH_REDIS_DEFAULT_KEY_PREFIX,
} from './auth-cache.constants';

export const BETTER_AUTH_REDIS_CLIENT = Symbol('BETTER_AUTH_REDIS_CLIENT');
export const BETTER_AUTH_SECONDARY_STORAGE = Symbol(
  'BETTER_AUTH_SECONDARY_STORAGE',
);

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: BETTER_AUTH_REDIS_CLIENT,
      inject: [ConfigService, AppLoggerService],
      useFactory: (config: ConfigService, logger: AppLoggerService) => {
        const client = new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          db:
            config.get<number>('BETTER_AUTH_REDIS_DB') ??
            BETTER_AUTH_REDIS_DEFAULT_DB,
          password: config.get<string>('REDIS_PASSWORD'),
          lazyConnect: true,
          retryStrategy: (times) => Math.min(times * 100, 2000),
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });

        client.on('connect', () =>
          logger.log(
            'Better Auth Redis secondary storage connected',
            'BetterAuthCache',
          ),
        );
        client.on('error', (err: Error) =>
          logger.warn(
            `Better Auth Redis error: ${err.message}`,
            'BetterAuthCache',
          ),
        );

        client.connect().catch(() => {});
        return client;
      },
    },
    {
      provide: BETTER_AUTH_SECONDARY_STORAGE,
      inject: [BETTER_AUTH_REDIS_CLIENT, ConfigService],
      useFactory: (client: Redis, config: ConfigService) => {
        const keyPrefix =
          config.get<string>('BETTER_AUTH_REDIS_PREFIX') ??
          BETTER_AUTH_REDIS_DEFAULT_KEY_PREFIX;
        return redisStorage({ client, keyPrefix });
      },
    },
  ],
  exports: [BETTER_AUTH_REDIS_CLIENT, BETTER_AUTH_SECONDARY_STORAGE],
})
export class BetterAuthCacheModule {}
