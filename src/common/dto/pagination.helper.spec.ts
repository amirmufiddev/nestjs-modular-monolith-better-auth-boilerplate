import { describe, expect, test } from 'bun:test';
import {
  buildPaginated,
  buildPaginatedFromResult,
  paginateList,
  resolveLimit,
  resolvePage,
} from './pagination.helper';
import { PaginatedResponseDto } from './paginated-response.dto';

describe('PaginationHelper', () => {
  describe('resolvePage', () => {
    test('returns 1 when query is undefined', () => {
      expect(resolvePage(undefined)).toBe(1);
    });

    test('returns 1 when query.page is undefined', () => {
      expect(resolvePage({ limit: 25 })).toBe(1);
    });

    test('returns the supplied page when provided', () => {
      expect(resolvePage({ page: 3, limit: 10 })).toBe(3);
    });
  });

  describe('resolveLimit', () => {
    test('returns 20 when query is undefined', () => {
      expect(resolveLimit(undefined)).toBe(20);
    });

    test('returns the supplied limit when provided', () => {
      expect(resolveLimit({ page: 1, limit: 50 })).toBe(50);
    });
  });

  describe('paginateList', () => {
    const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`);

    test('slices first page with default limit', () => {
      const result = paginateList(items, undefined);
      expect(result.items).toHaveLength(20);
      expect(result.items[0]).toBe('item-1');
      expect(result.items[19]).toBe('item-20');
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test('slices second page with explicit page/limit', () => {
      const result = paginateList(items, { page: 2, limit: 10 });
      expect(result.items).toHaveLength(10);
      expect(result.items[0]).toBe('item-11');
      expect(result.items[9]).toBe('item-20');
      expect(result.total).toBe(25);
    });

    test('returns empty slice when page is beyond data', () => {
      const result = paginateList(items, { page: 99, limit: 10 });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(25);
    });

    test('returns partial last page', () => {
      const result = paginateList(items, { page: 3, limit: 10 });
      expect(result.items).toHaveLength(5);
      expect(result.items[0]).toBe('item-21');
      expect(result.items[4]).toBe('item-25');
    });
  });

  describe('buildPaginated', () => {
    test('returns the standard envelope with meta computed from the query', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = buildPaginated(items, { page: 1, limit: 20 });
      expect(result).toBeInstanceOf(PaginatedResponseDto);
      expect(result.data).toEqual(items);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    test('fills defaults when query is undefined', () => {
      const items = [{ id: 1 }];
      const result = buildPaginated(items, undefined);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    test('totalPages is 0 when total is 0', () => {
      const result = buildPaginated([], { page: 1, limit: 20 });
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    test('totalPages rounds up for non-divisible totals', () => {
      const items = Array.from({ length: 21 }, (_, i) => i);
      const result = buildPaginated(items, { page: 1, limit: 10 });
      expect(result.meta.total).toBe(21);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('buildPaginatedFromResult', () => {
    test('preserves total and uses provided page/limit', () => {
      const items = [{ id: 'a' }, { id: 'b' }];
      const result = buildPaginatedFromResult(items, 100, 2, 25);
      expect(result.data).toEqual(items);
      expect(result.meta).toEqual({
        page: 2,
        limit: 25,
        total: 100,
        totalPages: 4,
      });
    });

    test('returns total 0 when no items', () => {
      const result = buildPaginatedFromResult([], 0, 1, 20);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
