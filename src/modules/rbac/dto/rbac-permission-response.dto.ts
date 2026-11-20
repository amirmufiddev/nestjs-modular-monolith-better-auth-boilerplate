import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RbacPermission } from '@/database/schema';

export class RbacPermissionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  resource!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  actionDisplayName!: string;

  @ApiPropertyOptional()
  actionDescription?: string;

  @ApiProperty()
  resourceDisplayName!: string;

  @ApiPropertyOptional()
  resourceDescription?: string;

  static fromEntity(entity: RbacPermission): RbacPermissionResponseDto {
    const dto = new RbacPermissionResponseDto();
    dto.id = entity.id;
    dto.resource = entity.resource;
    dto.action = entity.action;
    dto.code = `${entity.resource}:${entity.action}`;
    dto.actionDisplayName = entity.actionDisplayName;
    dto.actionDescription = entity.actionDescription ?? undefined;
    dto.resourceDisplayName = entity.resourceDisplayName;
    dto.resourceDescription = entity.resourceDescription ?? undefined;
    return dto;
  }
}
