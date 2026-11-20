import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertOrganizationRoleDto {
  @ApiProperty({ example: 'supervisor' })
  @IsString()
  @MaxLength(64)
  role!: string;

  @ApiProperty({
    example: { member: ['read'], ac: ['read'] },
    description: 'Map resource → daftar action (format Better Auth)',
  })
  @IsObject()
  permission!: Record<string, string[]>;

  @ApiPropertyOptional({
    example: { 'member:read': 'organization' },
    description: 'Map permission code → scope',
  })
  @IsOptional()
  @IsObject()
  permissionScopes?: Record<string, string>;
}

export class OrganizationRoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  permission!: Record<string, string[]>;

  @ApiProperty()
  permissionScopes!: Record<string, string>;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(entity: {
    id: string;
    organizationId: string;
    role: string;
    permission: string | null;
    permissionScopes: string | null;
    createdAt: Date;
  }): OrganizationRoleResponseDto {
    const dto = new OrganizationRoleResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.role = entity.role;
    dto.permission = entity.permission
      ? (JSON.parse(entity.permission) as Record<string, string[]>)
      : {};
    dto.permissionScopes = entity.permissionScopes
      ? (JSON.parse(entity.permissionScopes) as Record<string, string>)
      : {};
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
