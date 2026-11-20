import type { RegionalDataDto } from '../dto/regional.dto';

export const REGIONAL_REPOSITORY_TOKEN = Symbol('REGIONAL_REPOSITORY_TOKEN');

export type RegionalLevel = 'province' | 'regency' | 'district' | 'village';

export interface IRegionalRepository {
  findByLevel(level: RegionalLevel): Promise<RegionalDataDto[]>;
  findChildren(
    level: RegionalLevel,
    parentCode: number,
  ): Promise<RegionalDataDto[]>;
}
