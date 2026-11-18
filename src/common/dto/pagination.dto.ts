import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Standard pagination query params consumed by list endpoints.
 *
 * Defaults: page 1, limit 20, capped at 100 to prevent accidental
 * `?limit=99999` overloads.
 *
 * `sort` + `order` are intentionally generic strings so callers stay
 * loose-coupled; specific services whitelist allowed column names.
 */
export class PaginationDto {
  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    description: 'Halaman yang diminta',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Jumlah item per halaman',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Kolom untuk pengurutan' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Arah pengurutan',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'order must be asc or desc' })
  order: 'asc' | 'desc' = 'desc';

  /** Computed offset for repository queries. */
  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}
