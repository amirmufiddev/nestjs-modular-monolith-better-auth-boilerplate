import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { OrgMemberRole } from '../../api/dto/member.dto';

export class UpdateMemberRoleDto {
  @ApiProperty({
    example: 'admin',
    description: 'Role organisasi yang sudah didefinisikan (bukan owner)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  role!: OrgMemberRole;
}
