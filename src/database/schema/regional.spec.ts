import { describe, expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  regionalAddresses,
  regionalLevelEnum,
  type RegionalAddress,
  type NewRegionalAddress,
} from './regional';

describe('regional schema', () => {
  describe('regionalAddresses table', () => {
    const config = getTableConfig(regionalAddresses);

    test('uses the correct table name', () => {
      expect(regionalAddresses[Symbol.for('drizzle:Name')]).toBe(
        'regional_addresses',
      );
      expect(config.name).toBe('regional_addresses');
    });

    test('defines every expected column with correct DB names and constraints', () => {
      const cols = regionalAddresses as unknown as Record<
        string,
        {
          name: string;
          primary: boolean;
          notNull: boolean;
          dataType: string;
          columnType: string;
        }
      >;

      expect(cols.code).toMatchObject({
        name: 'code',
        primary: true,
        notNull: true,
        dataType: 'number',
        columnType: 'PgBigInt53',
      });

      expect(cols.name).toMatchObject({
        name: 'name',
        notNull: true,
        dataType: 'string',
        columnType: 'PgText',
      });
      expect(cols.name.primary).toBe(false);

      expect(cols.parentCode).toMatchObject({
        name: 'parent_code',
        primary: false,
        notNull: false,
        dataType: 'number',
        columnType: 'PgBigInt53',
      });

      expect(cols.postalCode).toMatchObject({
        name: 'postal_code',
        primary: false,
        notNull: false,
        dataType: 'string',
        columnType: 'PgVarchar',
      });
    });

    test('exposes `code` as the primary key and `name`/`level` as notNull', () => {
      expect(regionalAddresses.code.primary).toBe(true);
      expect(regionalAddresses.name.notNull).toBe(true);
      expect(regionalAddresses.level.notNull).toBe(true);
    });

    test('exposes the expected indexes on parent_code and level', () => {
      const indexNames = config.indexes
        .map((idx) => idx.config.name)
        .filter((name): name is string => typeof name === 'string');

      expect(indexNames).toContain('idx_regional_parent_code');
      expect(indexNames).toContain('idx_regional_level');

      const parentIdx = config.indexes.find(
        (idx) => idx.config.name === 'idx_regional_parent_code',
      );
      expect(parentIdx?.config.unique).toBe(false);
      const levelIdx = config.indexes.find(
        (idx) => idx.config.name === 'idx_regional_level',
      );
      expect(levelIdx?.config.unique).toBe(false);
    });
  });

  describe('regionalLevelEnum', () => {
    test('has the expected Postgres enum name', () => {
      expect(regionalLevelEnum.enumName).toBe('regional_level');
    });

    test('exposes only the four documented enum values', () => {
      expect(regionalLevelEnum.enumValues).toEqual([
        'province',
        'regency',
        'district',
        'village',
      ]);
    });

    test('is linked to the regionalAddresses.level column', () => {
      const levelCol = regionalAddresses.level as unknown as {
        enum: typeof regionalLevelEnum;
        columnType: string;
      };
      expect(levelCol.columnType).toBe('PgEnumColumn');
      expect(levelCol.enum).toBe(regionalLevelEnum);
      expect(levelCol.enum.enumName).toBe('regional_level');
      expect(levelCol.enum.enumValues).toEqual([
        'province',
        'regency',
        'district',
        'village',
      ]);
    });
  });

  describe('inferred row types', () => {
    test('RegionalAddress shape matches the table columns', () => {
      const row: Partial<RegionalAddress> = {
        code: 32,
        name: 'Jawa Barat',
        level: 'province',
        parentCode: null,
        postalCode: null,
      };
      expect(row.code).toBe(32);
      expect(row.level).toBe('province');
    });

    test('NewRegionalAddress accepts the same shape for inserts', () => {
      const insert: NewRegionalAddress = {
        code: 32,
        name: 'Jawa Barat',
        level: 'province',
      };
      expect(insert.code).toBe(32);
    });
  });
});
