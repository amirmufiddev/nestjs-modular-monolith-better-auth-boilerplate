import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRbacPermissionDto {
  @ApiProperty({ example: 'report' })
  @IsString()
  @MaxLength(64)
  resource!: string;

  @ApiProperty({ example: 'export' })
  @IsString()
  @MaxLength(64)
  action!: string;

  @ApiProperty({ example: 'Ekspor Laporan' })
  @IsString()
  @MaxLength(128)
  actionDisplayName!: string;

  @ApiProperty({ example: 'Laporan' })
  @IsString()
  @MaxLength(128)
  resourceDisplayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  actionDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  resourceDescription?: string;
}
