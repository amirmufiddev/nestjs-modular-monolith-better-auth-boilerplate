import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({
    example: 'Template Sample',
    description: 'Name of the template',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
