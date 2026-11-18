import { Injectable } from '@nestjs/common';
import type { RegionalApi } from '../api/regional.api';
import type { RegionalDataDto } from '../api/dto/regional.dto';

import { RegionalService } from '../application/regional.service';

/**
 * Public facade for the regional master-data module.
 *
 * Implements `RegionalApi` so other modules can consume regional lookups via
 * the `REGIONAL_API` injection token without crossing into
 * `application/`/`infrastructure/` directly.
 */
@Injectable()
export class RegionalFacade implements RegionalApi {
  constructor(private readonly regionalService: RegionalService) {}

  getProvinces(): Promise<RegionalDataDto[]> {
    return this.regionalService.getProvinces();
  }

  getRegencies(parentCode: number): Promise<RegionalDataDto[]> {
    return this.regionalService.getRegencies(parentCode);
  }

  getDistricts(parentCode: number): Promise<RegionalDataDto[]> {
    return this.regionalService.getDistricts(parentCode);
  }

  getVillages(parentCode: number): Promise<RegionalDataDto[]> {
    return this.regionalService.getVillages(parentCode);
  }
}
