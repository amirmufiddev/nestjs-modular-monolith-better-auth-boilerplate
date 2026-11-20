import { Inject, Injectable } from '@nestjs/common';
import { BusinessError } from '@/common/errors/business-error';
import type { RegionalDataDto } from '../dto/regional.dto';
import {
  REGIONAL_REPOSITORY_TOKEN,
  type IRegionalRepository,
} from '../interfaces/regional-repository.interface';

type ChildLevel = 'regency' | 'district' | 'village';

const CHILD_LEVEL_LABEL: Record<ChildLevel, string> = {
  regency: 'kabupaten/kota',
  district: 'kecamatan',
  village: 'kelurahan/desa',
};

/**
 * Application service for the regional master-data module.
 *
 * Wraps the repository with minimal validation (parent code presence for
 * non-province lookups) and forwards read requests. Keeps controllers free
 * of input-shape checks and ensures the repository is the only place where
 * the regional table is touched from the request path.
 */
@Injectable()
export class RegionalService {
  constructor(
    @Inject(REGIONAL_REPOSITORY_TOKEN)
    private readonly regionalRepo: IRegionalRepository,
  ) {}

  getProvinces(): Promise<RegionalDataDto[]> {
    return this.regionalRepo.findByLevel('province');
  }

  getRegencies(parentCode: number): Promise<RegionalDataDto[]> {
    return this.regionalRepo.findChildren(
      'regency',
      this.requireParentCode(parentCode, 'regency'),
    );
  }

  getDistricts(parentCode: number): Promise<RegionalDataDto[]> {
    return this.regionalRepo.findChildren(
      'district',
      this.requireParentCode(parentCode, 'district'),
    );
  }

  getVillages(parentCode: number): Promise<RegionalDataDto[]> {
    return this.regionalRepo.findChildren(
      'village',
      this.requireParentCode(parentCode, 'village'),
    );
  }

  private requireParentCode(parentCode: number, level: ChildLevel): number {
    if (
      parentCode === undefined ||
      parentCode === null ||
      Number.isNaN(parentCode) ||
      parentCode <= 0
    ) {
      throw BusinessError.badRequest(
        `Parameter parentCode wajib diisi untuk mengambil daftar ${CHILD_LEVEL_LABEL[level]}.`,
        'PARENT_CODE_REQUIRED',
      );
    }
    return parentCode;
  }
}
