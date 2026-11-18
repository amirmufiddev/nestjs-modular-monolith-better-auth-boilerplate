import { Global, Module } from '@nestjs/common';
import { CacheModule, type CacheManagerOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import Redis from 'ioredis';
import { AppLoggerService } from '@/logger/logger.service';
import { CacheService } from './cache.service';
import { CACHE_NAMESPACE } from './cache.constants';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      isGlobal: true,
      inject: [ConfigService, AppLoggerService],
      useFactory: (
        config: ConfigService,
        logger: AppLoggerService,
      ): CacheManagerOptions => {
        const redis = new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          db: config.getOrThrow<number>('REDIS_DB'),
          password: config.get<string>('REDIS_PASSWORD'),
          // Lazy connect: don't fail boot if Redis is down.
          lazyConnect: true,
          // Reconnect with exponential backoff up to 2 seconds.
          retryStrategy: (times) => Math.min(times * 100, 2000),
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });

        // Log Redis connection lifecycle events.
        redis.on('connect', () =>
          logger.log('Redis cache connected', CACHE_NAMESPACE),
        );
        redis.on('error', (err: Error) =>
          logger.warn(`Redis cache error: ${err.message}`, CACHE_NAMESPACE),
        );

        // Try initial connection (non-blocking; failures logged by 'error' handler).
        redis.connect().catch(() => {
          // Already handled by 'error' event listener.
        });

        const store = new KeyvRedis(redis as any);
        const keyv = new Keyv({
          store,
          namespace: CACHE_NAMESPACE,
          // Default TTL applied when caller doesn't pass `ttl` argument.
          ttl: 5 * 60 * 1000,
        });

        return {
          stores: [keyv],
          ttl: 5 * 60 * 1000,
        };
      },
      extraProviders: [CacheService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, CacheModule],
})
export class GlobalCacheModule {}
