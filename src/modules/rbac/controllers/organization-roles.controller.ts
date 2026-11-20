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
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BusinessError } from '@/common/errors/business-error';
import { RlsContext } from '@/shared/database/rls-context';
import { RequirePermission } from '../decorators';
import { OrganizationRoleService } from '../services/organization-role.service';
import {
  OrganizationRoleResponseDto,
  UpsertOrganizationRoleDto,
} from '../dto/organization-role.dto';

@ApiTags('RBAC')
@ApiBearerAuth()
@Controller('rbac/roles')
export class OrganizationRolesController {
  constructor(
    private readonly organizationRoleService: OrganizationRoleService,
  ) {}

  private requireActiveOrganizationId(): string {
    const organizationId = RlsContext.getCurrentOrganizationId();
    if (!organizationId) {
      throw BusinessError.unauthorized(
        'Anda harus memiliki organisasi aktif.',
        'ORGANIZATION_REQUIRED',
      );
    }
    return organizationId;
  }

  @Get()
  @RequirePermission('ac:read')
  @ApiOperation({ summary: 'Daftar role organisasi aktif beserta permission' })
  @ApiResponse({ status: 200, type: [OrganizationRoleResponseDto] })
  async list(): Promise<OrganizationRoleResponseDto[]> {
    const organizationId = this.requireActiveOrganizationId();
    const roles = await this.organizationRoleService.list(organizationId);
    return roles.map(OrganizationRoleResponseDto.fromEntity);
  }

  @Get(':roleId')
  @RequirePermission('ac:read')
  @ApiOperation({ summary: 'Detail role organisasi' })
  @ApiResponse({ status: 200, type: OrganizationRoleResponseDto })
  async getById(
    @Param('roleId') roleId: string,
  ): Promise<OrganizationRoleResponseDto> {
    const organizationId = this.requireActiveOrganizationId();
    const role = await this.organizationRoleService.getById(
      organizationId,
      roleId,
    );
    return OrganizationRoleResponseDto.fromEntity(role);
  }

  @Post()
  @RequirePermission('ac:create')
  @ApiOperation({ summary: 'Buat role kustom dengan daftar permission' })
  @ApiResponse({ status: 201, type: OrganizationRoleResponseDto })
  async create(
    @Body() body: UpsertOrganizationRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<OrganizationRoleResponseDto> {
    const organizationId = this.requireActiveOrganizationId();
    const created = await this.organizationRoleService.create(
      organizationId,
      body,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return OrganizationRoleResponseDto.fromEntity({
      id: created.id,
      organizationId: created.organizationId,
      role: created.role,
      permission: JSON.stringify(created.permission),
      permissionScopes: JSON.stringify(created.permissionScopes ?? {}),
      createdAt: new Date(),
    });
  }

  @Patch(':roleId')
  @RequirePermission('ac:update')
  @ApiOperation({ summary: 'Perbarui permission / nama role' })
  @ApiResponse({ status: 200, type: OrganizationRoleResponseDto })
  async update(
    @Param('roleId') roleId: string,
    @Body() body: UpsertOrganizationRoleDto,
    @Req() req: FastifyRequest,
  ): Promise<OrganizationRoleResponseDto> {
    const organizationId = this.requireActiveOrganizationId();
    const updated = await this.organizationRoleService.update(
      organizationId,
      roleId,
      body,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return OrganizationRoleResponseDto.fromEntity({
      id: updated.id,
      organizationId: updated.organizationId,
      role: updated.role,
      permission: JSON.stringify(updated.permission),
      permissionScopes: JSON.stringify(updated.permissionScopes ?? {}),
      createdAt: new Date(),
    });
  }

  @Delete(':roleId')
  @RequirePermission('ac:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus role kustom (bukan owner)' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('roleId') roleId: string,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const organizationId = this.requireActiveOrganizationId();
    await this.organizationRoleService.remove(
      organizationId,
      roleId,
      req.headers as Record<string, string | string[] | undefined>,
    );
  }
}
