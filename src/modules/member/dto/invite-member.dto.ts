import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'member',
    description:
      'Nama role dari katalog organisasi (mis. member, admin, supervisor)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  role!: string;
}
