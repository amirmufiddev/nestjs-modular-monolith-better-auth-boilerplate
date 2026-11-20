import { ApiProperty } from '@nestjs/swagger';

export class TemplateResponseDto {
  @ApiProperty({ example: 'tpl_123' })
  id!: string;

  @ApiProperty({ example: 'Template Sample' })
  name!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}
