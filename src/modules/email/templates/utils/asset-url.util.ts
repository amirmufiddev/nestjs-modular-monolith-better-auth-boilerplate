import { isSafeHttpUrl } from './url.util';

/**
 * Resolves a possibly-relative asset path to an absolute http/https URL.
 *
 * Safety guarantees:
 * - Returns `undefined` when the path is empty/null/undefined.
 * - Returns `undefined` when `baseUrl` is missing AND the path is relative
 *   (we cannot safely resolve without a base).
 * - Returns the absolute URL unchanged when it is a safe http/https URL.
 * - Returns `undefined` for any path that, once resolved, is not a safe
 *   http/https URL (rejects `javascript:`, `data:`, etc.).
 */
export function resolveAbsoluteAssetUrl(
  path: string | null | undefined,
  baseUrl: string | null | undefined,
): string | undefined {
  const trimmed = path?.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    return isSafeHttpUrl(trimmed) ? trimmed : undefined;
  }

  if (!baseUrl) return undefined;

  const normalizedBase = baseUrl.trim().replace(/\/$/, '');
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const resolved = `${normalizedBase}${normalizedPath}`;

  return isSafeHttpUrl(resolved) ? resolved : undefined;
}
