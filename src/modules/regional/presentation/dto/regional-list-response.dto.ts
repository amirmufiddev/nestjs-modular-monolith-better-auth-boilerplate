import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import type { RegionalDataDto } from '../../api/dto/regional.dto';

/**
 * HTTP response shape for a single regional entry returned by
 * `GET /api/v1/regional/{provinces|regencies|districts|villages}`.
 *
 * Controllers return `RegionalResponseDto[]` and let the global
 * `ResponseEnvelopeInterceptor` build the outer `{ success, data, meta }`
 * envelope — see `backend/src/common/interceptors/response-envelope.interceptor.ts`.
 */
export class RegionalResponseDto {
  @ApiProperty({ example: 31 })
  @Expose()
  code!: number;

  @ApiProperty({ example: 'DKI Jakarta' })
  @Expose()
  name!: string;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  parentCode!: number | null;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  postalCode!: string | null;

  static fromEntity(entry: RegionalDataDto): RegionalResponseDto {
    const dto = new RegionalResponseDto();
    dto.code = entry.code;
    dto.name = entry.name;
    dto.parentCode = entry.parentCode;
    dto.postalCode = entry.postalCode;
    return dto;
  }
}

/**
 * HTTP envelope metadata for non-paginated list responses.
 *
 * Mirrors the `meta` block injected by `ResponseEnvelopeInterceptor` for any
 * payload that is **not** a `PaginatedResponseDto`. Kept narrow on purpose —
 * paginated envelopes use `PaginationMetaDto` (see
 * `backend/src/common/dto/paginated-response.dto.ts`).
 */
export class RegionalEnvelopeMetaDto {
  @ApiProperty({ example: '2026-08-02T03:00:00.000Z' })
  @Expose()
  timestamp!: string;

  @ApiProperty({ example: 'req-12345', nullable: true })
  @Expose()
  requestId!: string | null;
}

/**
 * Standard success-envelope wrapper for the regional list endpoints.
 *
 * The controller returns `RegionalResponseDto[]` directly; the global
 * `ResponseEnvelopeInterceptor` produces this shape on the wire:
 *
 * ```json
 * {
 *   "success": true,
 *   "data": [ { "code": 31, "name": "DKI Jakarta", ... } ],
 *   "meta": { "timestamp": "2026-08-02T...", "requestId": "req-..." }
 * }
 * ```
 *
 * Referenced from `@ApiOkResponse({ type: RegionalEnvelopeDto })` in
 * `regional.controller.ts` so the generated OpenAPI document matches the
 * actual response shape (previously documented as a raw array, which would
 * have misled API consumers).
 */
export class RegionalEnvelopeDto {
  @ApiProperty({ example: true })
  @Expose()
  success!: boolean;

  @ApiProperty({ type: () => [RegionalResponseDto] })
  @Expose()
  data!: RegionalResponseDto[];

  @ApiProperty({ type: () => RegionalEnvelopeMetaDto })
  @Expose()
  meta!: RegionalEnvelopeMetaDto;
}
