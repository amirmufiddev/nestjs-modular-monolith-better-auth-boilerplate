import { ApiProperty } from '@nestjs/swagger';
import type { TemplateItemDto } from '../../api/dto/template.dto';

export class TemplateResponseDto implements TemplateItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}
