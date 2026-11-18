import type { RegionalDataDto } from './dto/regional.dto';

export const REGIONAL_API = Symbol('REGIONAL_API');

/**
 * Public contract for the regional master-data module.
 *
 * Other modules SHOULD consume regional lookups via this interface (and the
 * `REGIONAL_API` injection token) to comply with the
 * `modular-monolith/no-cross-module-import` ESLint rule, which forbids direct imports
 * across module boundaries into `infrastructure/` or `domain/`.
 *
 * `parentCode` is a numeric `bigint`-backed value (max 13 digits in the
 * current dataset) — the dots present in the upstream `wilayah.sql` dump
 * (`11.01.01.2001`) are stripped at ingestion time so lookups and joins are
 * pure integer comparisons.
 */
export interface RegionalApi {
  getProvinces(): Promise<RegionalDataDto[]>;
  getRegencies(parentCode: number): Promise<RegionalDataDto[]>;
  getDistricts(parentCode: number): Promise<RegionalDataDto[]>;
  getVillages(parentCode: number): Promise<RegionalDataDto[]>;
}
