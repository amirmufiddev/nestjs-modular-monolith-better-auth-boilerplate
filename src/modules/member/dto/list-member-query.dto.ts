import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { OrgMemberRole } from './member.dto';

export class ListMemberQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'member',
    enum: ['admin', 'driver', 'member'],
    description:
      'Owner role sengaja tidak dapat difilter dari listing halaman Anggota.',
  })
  @IsOptional()
  @IsIn(['admin', 'driver', 'member'])
  role?: OrgMemberRole;

  @ApiPropertyOptional({ example: 'Budi' })
  @IsOptional()
  @IsString()
  search?: string;
}
