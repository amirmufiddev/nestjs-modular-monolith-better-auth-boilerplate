/**
 * Default TTL (time-to-live) for cache entries when caller does not specify one.
 * 5 minutes balances freshness with hit rate for typical reference data
 * (regional codes, AI config, RBAC scopes).
 */
export const DEFAULT_TTL_MS = 5 * 60 * 1000; // 300_000 ms = 5 minutes

/**
 * Keyv namespace used internally by cache-manager@6.
 * Distinguishes our entries from other Keyv clients sharing the same Redis DB.
 */
export const CACHE_NAMESPACE = 'app:cache';
