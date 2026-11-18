import { authConfig } from '@/config/auth.config';
import type { OpenAPIObject } from '@nestjs/swagger';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

const HTTP_METHODS: readonly HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
];

interface PathItemLike {
  [method: string]: { tags?: string[]; [k: string]: unknown } | undefined;
}

interface MergeOptions {
  betterAuthTagPrefix?: string;
  customPathPrefix?: string;
}

/**
 * Merges two OpenAPI specs into one.
 * Better Auth paths are mounted under BETTER_AUTH_PATH, with their tags prefixed
 * using the configured Better Auth tag prefix. Tag prefix and Better Auth path
 * mounting are idempotent — calling the function multiple times will not
 * re-prefix or duplicate paths.
 */
export function mergeOpenAPISpecs(
  betterAuthSpec: OpenAPIObject,
  customSpec: OpenAPIObject,
  options: MergeOptions = {},
): OpenAPIObject {
  const { betterAuthTagPrefix, customPathPrefix = '' } = options;

  const mergedPaths: OpenAPIObject['paths'] = {};

  for (const [path, pathItem] of Object.entries(betterAuthSpec.paths ?? {})) {
    const prefixedPath = ensureBetterAuthPathPrefix(path);
    // Cast required: OpenAPI PathItem type is flexible, but we need specific structure for tag prefixing
    const prefixedPathItem = prefixBetterAuthTags(
      pathItem as unknown as PathItemLike,
      betterAuthTagPrefix,
    );
    mergedPaths[prefixedPath] = prefixedPathItem;
  }

  for (const [path, pathItem] of Object.entries(customSpec.paths ?? {})) {
    const prefixedPath = `${customPathPrefix}${path}`;
    mergedPaths[prefixedPath] = pathItem;
  }

  const mergedComponents: OpenAPIObject['components'] = {
    schemas: {
      ...(betterAuthSpec.components?.schemas ?? {}),
      ...(customSpec.components?.schemas ?? {}),
    },
    securitySchemes: {
      ...(betterAuthSpec.components?.securitySchemes ?? {}),
      ...(customSpec.components?.securitySchemes ?? {}),
    },
  };

  const customTagNames = new Set(
    (customSpec.tags ?? []).map((t) => (typeof t === 'string' ? t : t.name)),
  );

  const betterAuthTags = (betterAuthSpec.tags ?? [])
    .filter((t) => !customTagNames.has(typeof t === 'string' ? t : t.name))
    .map((t) => {
      const tagName = typeof t === 'string' ? t : t.name;
      const tagDescription = typeof t === 'string' ? undefined : t.description;
      const prefixedName = betterAuthTagPrefix
        ? `${betterAuthTagPrefix}:${tagName}`
        : tagName;
      return { name: prefixedName, description: tagDescription };
    });

  const mergedSpec: OpenAPIObject = {
    ...customSpec,
    ...betterAuthSpec,
    paths: mergedPaths,
    components: mergedComponents,
    tags: [...betterAuthTags, ...(customSpec.tags ?? [])],
  };

  if (customSpec.security) {
    mergedSpec.security = customSpec.security;
  }

  if (customSpec.info) {
    mergedSpec.info = {
      ...betterAuthSpec.info,
      ...customSpec.info,
    };
  }

  return mergedSpec;
}

function ensureBetterAuthPathPrefix(path: string): string {
  const prefix = authConfig().path;
  if (path.startsWith(prefix)) return path;
  return `${prefix}${path}`;
}

function prefixBetterAuthTags(
  pathItem: PathItemLike,
  tagPrefix: string | undefined,
): PathItemLike {
  if (!tagPrefix) return pathItem;
  const next: PathItemLike = { ...pathItem };
  for (const method of HTTP_METHODS) {
    const operation = next[method];
    if (!operation) continue;
    const existingTags = operation.tags;
    if (!existingTags || existingTags.length === 0) continue;
    const isAlreadyPrefixed = existingTags.every((t) =>
      t.startsWith(`${tagPrefix}:`),
    );
    if (isAlreadyPrefixed) continue;
    next[method] = {
      ...operation,
      tags: existingTags.map((tag) => `${tagPrefix}:${tag}`),
    };
  }
  return next;
}
