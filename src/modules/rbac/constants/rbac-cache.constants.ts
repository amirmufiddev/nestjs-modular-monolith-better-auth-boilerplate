/** Cache key namespace for RBAC scope resolution caching. */
export const RBAC_SCOPE_CACHE_NAMESPACE = 'rbac:scope';

/** Key pattern for resolved scope cache entries. */
export const RBAC_SCOPE_KEY_PREFIX = 'rbac:scope:';

/** Key index prefix for per-org invalidation tracking (Redis SET). */
export const RBAC_KEYS_ORG_PREFIX = 'rbac:keys:org:';
