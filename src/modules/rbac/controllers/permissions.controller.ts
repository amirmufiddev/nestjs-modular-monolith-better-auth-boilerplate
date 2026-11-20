import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RequirePermission } from '../decorators';
import {
  PermissionsResponseDto,
  PermissionCodesResponseDto,
} from '../dto/permission.dto';
import { RbacPermissionService } from '../services/rbac-permission.service';
import { CreateRbacPermissionDto } from '../dto/create-rbac-permission.dto';
import { UpdateRbacPermissionDto } from '../dto/update-rbac-permission.dto';
import { RbacPermissionResponseDto } from '../dto/rbac-permission-response.dto';

@ApiTags('RBAC')
@ApiBearerAuth()
@Controller('rbac/permissions')
export class PermissionsController {
  constructor(private readonly rbacPermissionService: RbacPermissionService) {}

  @Get()
  @RequirePermission('ac:read')
  @ApiOperation({ summary: 'Katalog permission (dari database)' })
  @ApiResponse({ status: 200, type: PermissionsResponseDto })
  async getPermissions(): Promise<PermissionsResponseDto> {
    return this.rbacPermissionService.getCatalog();
  }

  @Get('codes')
  @RequirePermission('ac:read')
  @ApiOperation({ summary: 'Daftar flat kode permission' })
  @ApiResponse({ status: 200, type: PermissionCodesResponseDto })
  async getPermissionCodes(): Promise<PermissionCodesResponseDto> {
    const codes = await this.rbacPermissionService.getPermissionCodes();
    return { codes };
  }

  @Get(':id')
  @RequirePermission('ac:read')
  @ApiOperation({ summary: 'Detail satu permission' })
  @ApiResponse({ status: 200, type: RbacPermissionResponseDto })
  async getById(@Param('id') id: string): Promise<RbacPermissionResponseDto> {
    const row = await this.rbacPermissionService.getById(id);
    return RbacPermissionResponseDto.fromEntity(row);
  }

  @Post()
  @RequirePermission('ac:create')
  @ApiOperation({
    summary: 'Tambah permission ke katalog',
    description:
      'Permission baru di Better Auth statement aktif setelah restart aplikasi.',
  })
  @ApiResponse({ status: 201, type: RbacPermissionResponseDto })
  async create(
    @Body() body: CreateRbacPermissionDto,
  ): Promise<RbacPermissionResponseDto> {
    const row = await this.rbacPermissionService.create(body);
    return RbacPermissionResponseDto.fromEntity(row);
  }

  @Patch(':id')
  @RequirePermission('ac:update')
  @ApiOperation({ summary: 'Perbarui metadata permission (label/deskripsi)' })
  @ApiResponse({ status: 200, type: RbacPermissionResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateRbacPermissionDto,
  ): Promise<RbacPermissionResponseDto> {
    const row = await this.rbacPermissionService.update(id, body);
    return RbacPermissionResponseDto.fromEntity(row);
  }

  @Delete(':id')
  @RequirePermission('ac:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete permission dari katalog' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: string): Promise<void> {
    await this.rbacPermissionService.remove(id);
  }
}
