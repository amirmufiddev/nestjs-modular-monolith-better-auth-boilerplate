import { ApiProperty } from '@nestjs/swagger';

export class ActionDto {
  @ApiProperty({ example: 'Buat Transaksi' })
  displayName: string;

  @ApiProperty({ example: 'Membuat transaksi baru', required: false })
  description?: string;
}

export class ResourcePermissionDto {
  @ApiProperty({ example: 'transaction' })
  resource: string;

  @ApiProperty({ example: 'Transaksi' })
  displayName: string;

  @ApiProperty({ example: 'Manajemen transaksi penjualan', required: false })
  description?: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  actions: Record<string, ActionDto>;
}

export class PermissionCodeDto {
  @ApiProperty({ example: 'transaction:read' })
  code: string;

  @ApiProperty({ example: 'transaction' })
  resource: string;

  @ApiProperty({ example: 'read' })
  action: string;

  @ApiProperty({ example: 'Lihat Transaksi' })
  displayName: string;
}

export class PermissionsResponseDto {
  @ApiProperty({ type: [ResourcePermissionDto] })
  resources: ResourcePermissionDto[];

  @ApiProperty({ type: [PermissionCodeDto] })
  permissions: PermissionCodeDto[];
}

export class PermissionCodesResponseDto {
  @ApiProperty({
    type: [String],
    example: ['member:read', 'broadcast:trigger'],
    description: 'Daftar flat kode permission',
  })
  codes!: string[];
}
