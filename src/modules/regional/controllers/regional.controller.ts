import { Controller, Get, Query } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { BusinessError } from '@/common/errors/business-error';
import { RegionalService } from '../services/regional.service';
import {
  RegionalEnvelopeDto,
  RegionalResponseDto,
} from '../dto/regional-list-response.dto';

/**
 * HTTP controller for the regional master-data module.
 *
 * Exposes read-only endpoints for Indonesian regions
 * (provinces/regencies/districts/villages). Endpoints are anonymous so the
 * application forms (registration, organization profile setup) can pre-load region
 * pickers before a user has an active organization/organization context.
 *
 * Response shape: each handler returns the DTO array directly. The global
 * `ResponseEnvelopeInterceptor` wraps it into `{ success, data, meta }` —
 * we do not pre-wrap here to avoid a double `{ data: { data: [...] } }`
 * envelope. The OpenAPI decorators document the wrapped envelope
 * (`RegionalEnvelopeDto`) so the generated schema matches the wire shape
 * consumers actually receive.
 */
@ApiTags('Regional')
@Controller('regional')
export class RegionalController {
  constructor(private readonly regionalService: RegionalService) {}

  @Get('provinces')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Mendapatkan daftar seluruh provinsi di Indonesia',
  })
  @ApiOkResponse({
    description: 'Daftar provinsi dibungkus envelope standar',
    type: RegionalEnvelopeDto,
  })
  async getProvinces(): Promise<RegionalResponseDto[]> {
    const items = await this.regionalService.getProvinces();
    return items.map(RegionalResponseDto.fromEntity);
  }

  @Get('regencies')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Mendapatkan daftar kabupaten/kota berdasarkan kode provinsi',
  })
  @ApiQuery({
    name: 'parentCode',
    example: 31,
    description: 'Kode provinsi parent (regional_addresses.code)',
  })
  @ApiOkResponse({
    description: 'Daftar kabupaten/kota dibungkus envelope standar',
    type: RegionalEnvelopeDto,
  })
  @ApiBadRequestResponse({
    description: 'parentCode wajib diisi',
    type: ErrorResponseDto,
  })
  async getRegencies(
    @Query('parentCode') parentCode: string,
  ): Promise<RegionalResponseDto[]> {
    const items = await this.regionalService.getRegencies(
      this.parseParentCode(parentCode),
    );
    return items.map(RegionalResponseDto.fromEntity);
  }

  @Get('districts')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Mendapatkan daftar kecamatan berdasarkan kode kabupaten/kota',
  })
  @ApiQuery({
    name: 'parentCode',
    example: 3171,
    description: 'Kode kabupaten/kota parent (regional_addresses.code)',
  })
  @ApiOkResponse({
    description: 'Daftar kecamatan dibungkus envelope standar',
    type: RegionalEnvelopeDto,
  })
  @ApiBadRequestResponse({
    description: 'parentCode wajib diisi',
    type: ErrorResponseDto,
  })
  async getDistricts(
    @Query('parentCode') parentCode: string,
  ): Promise<RegionalResponseDto[]> {
    const items = await this.regionalService.getDistricts(
      this.parseParentCode(parentCode),
    );
    return items.map(RegionalResponseDto.fromEntity);
  }

  @Get('villages')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Mendapatkan daftar kelurahan/desa berdasarkan kode kecamatan',
  })
  @ApiQuery({
    name: 'parentCode',
    example: 317101,
    description: 'Kode kecamatan parent (regional_addresses.code)',
  })
  @ApiOkResponse({
    description: 'Daftar kelurahan/desa dibungkus envelope standar',
    type: RegionalEnvelopeDto,
  })
  @ApiBadRequestResponse({
    description: 'parentCode wajib diisi',
    type: ErrorResponseDto,
  })
  async getVillages(
    @Query('parentCode') parentCode: string,
  ): Promise<RegionalResponseDto[]> {
    const items = await this.regionalService.getVillages(
      this.parseParentCode(parentCode),
    );
    return items.map(RegionalResponseDto.fromEntity);
  }

  /**
   * Accept either the canonical numeric code (e.g. `3171`) or the legacy
   * dot-separated form (`31.71`). Strips dots before parsing so existing
   * clients still work after the schema migration.
   */
  private parseParentCode(raw: string | undefined): number {
    if (!raw) {
      throw BusinessError.badRequest(
        'Parameter parentCode wajib diisi.',
        'PARENT_CODE_REQUIRED',
      );
    }
    const stripped = raw.replace(/\./g, '');
    if (!/^\d+$/.test(stripped)) {
      throw BusinessError.badRequest(
        'Parameter parentCode harus berupa angka.',
        'PARENT_CODE_INVALID',
      );
    }
    return Number(stripped);
  }
}
