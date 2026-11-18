import { describe, expect, test } from 'bun:test';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from './paginated-response.dto';

interface Item {
  id: string;
  name: string;
}

describe('PaginatedResponseDto', () => {
  describe('from()', () => {
    test('builds the standard envelope with correct meta', () => {
      const items: Item[] = [{ id: '1', name: 'A' }];
      const result = PaginatedResponseDto.from(items, 1, 1, 20);

      expect(result.data).toEqual(items);
      expect(result.meta).toBeInstanceOf(PaginationMetaDto);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    test('totalPages is 0 when total is 0', () => {
      const result = PaginatedResponseDto.from([], 0, 1, 20);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    test('totalPages is 0 when limit is 0 to avoid divide-by-zero', () => {
      const result = PaginatedResponseDto.from([], 10, 1, 0);
      expect(result.meta.totalPages).toBe(0);
    });

    test('totalPages rounds up for partial pages', () => {
      const result = PaginatedResponseDto.from([], 21, 1, 10);
      expect(result.meta.totalPages).toBe(3);
    });

    test('preserves the items array reference, not a copy', () => {
      const items: Item[] = [{ id: '1', name: 'A' }];
      const result = PaginatedResponseDto.from(items, 1, 1, 20);
      expect(result.data).toBe(items);
    });

    test('exposes the typed generic at the call site', () => {
      const result = PaginatedResponseDto.from<string>([], 0, 1, 20);
      const _check: string[] = result.data;
      expect(_check).toBeDefined();
    });
  });

  describe('PaginationMetaDto', () => {
    test('contains all four required fields', () => {
      const meta = new PaginationMetaDto();
      meta.page = 1;
      meta.limit = 20;
      meta.total = 100;
      meta.totalPages = 5;
      expect(meta).toEqual({
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      });
    });
  });
});
