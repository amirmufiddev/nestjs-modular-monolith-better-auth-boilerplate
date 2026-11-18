import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response envelope for paginated list endpoints.
 *
 * Mirrors the JSON:API / common practice shape and lets clients lazily
 * paginate without re-implementing `totalPages` math.
 */
export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;

  /**
   * Optional marker callers can populate when the resource carries additional
   * aggregate metrics tied to the entire dataset (e.g. notification's
   * `unreadCount`). Left undefined by `PaginatedResponseDto.from()` so the
   * default envelope stays minimal.
   */
  @ApiPropertyOptional({ example: 3 })
  unreadCount?: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data!: T[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;

  static from<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const dto = new PaginatedResponseDto<T>();
    dto.data = items;
    const meta = new PaginationMetaDto();
    meta.page = page;
    meta.limit = limit;
    meta.total = total;
    meta.totalPages = limit === 0 ? 0 : Math.ceil(total / limit);
    dto.meta = meta;
    return dto;
  }
}
