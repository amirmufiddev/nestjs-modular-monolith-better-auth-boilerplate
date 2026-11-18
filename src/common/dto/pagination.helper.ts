import { PaginatedResponseDto } from './paginated-response.dto';

/**
 * Utility helpers for building the standard paginated response envelope.
 *
 * Every list endpoint in the API should return exactly this shape:
 * `{ data: T[], meta: { page, limit, total, totalPages } }`.
 *
 * Two flavors are exposed so callers can use whichever fits naturally:
 * - `buildPaginated(items, total, query)` — accepts a `PaginationDto`-like input
 * - `buildPaginatedFromResult(items, total, page, limit)` — accepts raw numbers
 *
 * Both ultimately delegate to `PaginatedResponseDto.from`, ensuring every
 * paginated endpoint produces the same envelope.
 */

export interface PaginationLike {
  page?: number;
  limit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export function resolvePage(query: PaginationLike | undefined): number {
  return query?.page ?? DEFAULT_PAGE;
}

export function resolveLimit(query: PaginationLike | undefined): number {
  return query?.limit ?? DEFAULT_LIMIT;
}

/**
 * Slice a fully-loaded list into one page using page/limit pulled from the query.
 * Returns the page slice plus the original total so the caller can build the
 * envelope without re-querying the count.
 */
export function paginateList<T>(
  items: T[],
  query: PaginationLike | undefined,
): { items: T[]; total: number; page: number; limit: number } {
  const page = resolvePage(query);
  const limit = resolveLimit(query);
  const offset = (page - 1) * limit;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    page,
    limit,
  };
}

/**
 * Build the standard `{ data, meta }` envelope from a fully-loaded list and the
 * pagination query DTO. Useful for in-memory pagination in the controller.
 */
export function buildPaginated<T>(
  items: T[],
  query: PaginationLike | undefined,
): PaginatedResponseDto<T> {
  const slice = paginateList(items, query);
  return PaginatedResponseDto.from(
    slice.items,
    slice.total,
    slice.page,
    slice.limit,
  );
}

/**
 * Build the standard envelope from already-paginated data (i.e. the service
 * has already applied `limit`/`offset` and returned `total`). This is the
 * canonical helper for every controller that delegates to a `findAll`-style
 * repository method.
 */
export function buildPaginatedFromResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  return PaginatedResponseDto.from(items, total, page, limit);
}
