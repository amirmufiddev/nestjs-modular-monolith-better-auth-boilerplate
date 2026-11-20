import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import type { MemberDto, OrgMemberRole } from './member.dto';

export class MemberResponseDto {
  @ApiProperty({ example: 'mem-123' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'usr-123' })
  @Expose()
  userId!: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @Expose()
  name!: string;

  @ApiProperty({ example: 'budi@example.com' })
  @Expose()
  email!: string;

  @ApiPropertyOptional({ example: '08123456789', nullable: true })
  @Expose()
  phone!: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @Expose()
  image!: string | null;

  @ApiProperty({
    example: 'member',
    enum: ['owner', 'admin', 'member'],
  })
  @Expose()
  role!: OrgMemberRole;

  @ApiProperty({ example: '2026-08-02T00:00:00.000Z' })
  @Expose()
  createdAt!: Date;

  static fromEntity(dto: MemberDto): MemberResponseDto {
    const res = new MemberResponseDto();
    res.id = dto.id;
    res.userId = dto.userId;
    res.name = dto.name;
    res.email = dto.email;
    res.phone = dto.phone;
    res.image = dto.image;
    res.role = dto.role;
    res.createdAt = dto.createdAt;
    return res;
  }
}

export type MemberListItemDto = MemberResponseDto;
