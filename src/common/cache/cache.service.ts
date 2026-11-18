import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AppLoggerService } from '@/logger/logger.service';
import { RlsContext } from '@/shared/database/rls-context';
import { DEFAULT_TTL_MS } from './cache.constants';

@Injectable()
export class CacheService {
  private readonly context = CacheService.name;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Get a value from cache.
   * Returns `undefined` on Redis errors (cache miss; caller should re-query DB).
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.cacheManager.get<T>(key)) ?? undefined;
    } catch (err) {
      this.logger.warn(
        `Cache get failed for key "${key}": ${(err as Error).message}`,
        this.context,
      );
      return undefined;
    }
  }

  /**
   * Set a value in cache with optional TTL (defaults to DEFAULT_TTL_MS).
   * Silent no-op on Redis errors.
   */
  async set<T>(
    key: string,
    value: T,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs);
    } catch (err) {
      this.logger.warn(
        `Cache set failed for key "${key}": ${(err as Error).message}`,
        this.context,
      );
    }
  }

  /**
   * Delete a key from cache. Silent no-op on errors.
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (err) {
      this.logger.warn(
        `Cache del failed for key "${key}": ${(err as Error).message}`,
        this.context,
      );
    }
  }

  /**
   * Delete multiple keys from cache. Silent no-op on errors.
   */
  async delMany(keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await Promise.all(keys.map((k) => this.del(k)));
    } catch (err) {
      this.logger.warn(
        `Cache delMany failed for ${keys.length} keys: ${(err as Error).message}`,
        this.context,
      );
    }
  }

  /**
   * Get a value or compute + cache it if absent.
   * On Redis error, falls back to calling the factory directly (no caching).
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Build a tenant-scoped key using RlsContext.getCurrentOrganizationId().
   * Returns `${globalPrefix}:${tenantId}:${key}` when in request context,
   * or `${globalPrefix}:${key}` otherwise.
   */
  buildKey(key: string, globalPrefix: string): string {
    const tenantId = RlsContext.getCurrentOrganizationId();
    return tenantId
      ? `${globalPrefix}:${tenantId}:${key}`
      : `${globalPrefix}:${key}`;
  }

  /**
   * Set a value with an explicit tenantId (for background jobs without RlsContext).
   */
  async setScoped<T>(
    tenantId: string,
    key: string,
    value: T,
    globalPrefix: string,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<void> {
    const fullKey = `${globalPrefix}:${tenantId}:${key}`;
    await this.set(fullKey, value, ttlMs);
  }
}
