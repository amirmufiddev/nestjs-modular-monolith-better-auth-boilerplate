import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class InvitationResponseDto {
  @ApiProperty({ example: 'inv_123' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'amirmufid001@gmail.com' })
  @Expose()
  email!: string;

  @ApiProperty({
    example: 'member',
    enum: ['owner', 'admin', 'driver', 'member'],
  })
  @Expose()
  role!: string;

  @ApiProperty({ example: 'organization-123' })
  @Expose()
  organizationId!: string;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'accepted', 'rejected', 'canceled'],
  })
  @Expose()
  status!: string;

  @ApiPropertyOptional({ example: '2026-08-09T00:00:00.000Z', nullable: true })
  @Expose()
  expiresAt!: Date | string | null;

  @ApiPropertyOptional({ example: '2026-08-02T00:00:00.000Z', nullable: true })
  @Expose()
  createdAt!: Date | string | null;

  static from(raw: unknown): InvitationResponseDto {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const dto = new InvitationResponseDto();
    dto.id = String(obj.id ?? '');
    dto.email = String(obj.email ?? '');
    dto.role = String(obj.role ?? '');
    dto.organizationId = String(obj.organizationId ?? '');
    dto.status = String(obj.status ?? 'pending');
    dto.expiresAt = (obj.expiresAt as Date | string | null) ?? null;
    dto.createdAt = (obj.createdAt as Date | string | null) ?? null;
    return dto;
  }
}
