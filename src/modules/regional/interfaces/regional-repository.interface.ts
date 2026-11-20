import type {
  DistrictItemDto,
  ProvinceItemDto,
  RegencyItemDto,
  RegionalDataDto,
  VillageItemDto,
} from '../dto/regional.dto';

export const REGIONAL_REPOSITORY_TOKEN = Symbol('REGIONAL_REPOSITORY_TOKEN');

export type RegionalLevel = 'province' | 'regency' | 'district' | 'village';

export interface ListProvincesParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListRegenciesParams {
  provinceId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListDistrictsParams {
  regencyId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListVillagesParams {
  districtId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IRegionalRepository {
  findByLevel(level: RegionalLevel): Promise<RegionalDataDto[]>;
  findChildren(
    level: RegionalLevel,
    parentCode: number,
  ): Promise<RegionalDataDto[]>;
  findProvinces?(params?: ListProvincesParams): Promise<ProvinceItemDto[]>;
  findRegencies?(params?: ListRegenciesParams): Promise<RegencyItemDto[]>;
  findDistricts?(params?: ListDistrictsParams): Promise<DistrictItemDto[]>;
  findVillages?(params?: ListVillagesParams): Promise<VillageItemDto[]>;
  findProvinceById?(id: string): Promise<ProvinceItemDto | null>;
  findRegencyById?(id: string): Promise<RegencyItemDto | null>;
  findDistrictById?(id: string): Promise<DistrictItemDto | null>;
  findVillageById?(id: string): Promise<VillageItemDto | null>;
}
