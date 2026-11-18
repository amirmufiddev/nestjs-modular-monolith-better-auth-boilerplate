/**
 * Constants for Better Auth secondary storage Redis instance.
 *
 * This ioredis client is SEPARATE from the GlobalCacheModule client:
 * - DB 0: app cache adapter (CacheService)
 * - DB 1: Better Auth secondary storage (session, verification, rate limit)
 */
export const BETTER_AUTH_REDIS_DEFAULT_DB = 1;
export const BETTER_AUTH_REDIS_DEFAULT_KEY_PREFIX = 'better-auth:';
