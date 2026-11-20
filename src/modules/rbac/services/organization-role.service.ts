import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { BusinessError } from '@/common/errors/business-error';
import { OrganizationRole } from '@/database/schema';
import {
  ORGANIZATION_ROLE_REPOSITORY_TOKEN,
  type IOrganizationRoleRepository,
} from '../interfaces/organization-role-repository.interface';
import type { UpsertOrganizationRoleDto } from '../dto/organization-role.dto';

const RESERVED_OWNER = 'owner';

type BetterAuthOrganizationRole = {
  id: string;
  role: string;
  organizationId: string;
  permission: Record<string, string[]>;
  permissionScopes?: Record<string, string>;
};

@Injectable()
export class OrganizationRoleService {
  constructor(
    @Inject(ORGANIZATION_ROLE_REPOSITORY_TOKEN)
    private readonly roleRepo: IOrganizationRoleRepository,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string): Promise<OrganizationRole[]> {
    return this.roleRepo.findByOrganization(organizationId);
  }

  async getById(
    organizationId: string,
    roleId: string,
  ): Promise<OrganizationRole> {
    const role = await this.roleRepo.findById(organizationId, roleId);
    if (!role) {
      throw BusinessError.notFound('Organization role', roleId);
    }
    return role;
  }

  async create(
    organizationId: string,
    dto: UpsertOrganizationRoleDto,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<BetterAuthOrganizationRole> {
    this.assertRoleName(dto.role);

    const api = this.authService.api as any;

    const result = await api.createOrgRole({
      body: {
        organizationId,
        role: dto.role,
        permission: dto.permission,
        additionalFields: {
          permissionScopes: JSON.stringify(dto.permissionScopes ?? {}),
        },
      },
      headers,
    });

    this.eventEmitter.emit('rbac.cache.invalidate', { orgId: organizationId });

    return result.roleData;
  }

  async update(
    organizationId: string,
    roleId: string,
    dto: UpsertOrganizationRoleDto,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<BetterAuthOrganizationRole> {
    const existing = await this.getById(organizationId, roleId);
    if (existing.role === RESERVED_OWNER) {
      throw BusinessError.forbidden(
        'Role owner tidak dapat diubah',
        'OWNER_ROLE_IMMUTABLE',
      );
    }

    const api = this.authService.api as any;

    const data: {
      permission?: Record<string, string[]>;
      roleName?: string;
      permissionScopes?: string;
    } = {
      permission: dto.permission,
      permissionScopes: JSON.stringify(dto.permissionScopes ?? {}),
    };

    if (dto.role && dto.role.toLowerCase() !== existing.role) {
      this.assertRoleName(dto.role);
      data.roleName = dto.role;
    }

    const updated = await api.updateOrgRole({
      body: {
        organizationId,
        roleId,
        data,
      },
      headers,
    });

    this.eventEmitter.emit('rbac.cache.invalidate', { orgId: organizationId });

    return updated;
  }

  async remove(
    organizationId: string,
    roleId: string,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const existing = await this.getById(organizationId, roleId);
    if (existing.role === RESERVED_OWNER) {
      throw BusinessError.forbidden(
        'Role owner tidak dapat dihapus',
        'OWNER_ROLE_IMMUTABLE',
      );
    }

    const api = this.authService.api as any;

    await api.deleteOrgRole({
      body: { organizationId, roleId },
      headers,
    });

    this.eventEmitter.emit('rbac.cache.invalidate', { orgId: organizationId });
  }

  async assertAssignableRole(
    organizationId: string,
    roleName: string,
  ): Promise<void> {
    const normalized = roleName.toLowerCase();
    if (normalized === RESERVED_OWNER) {
      throw BusinessError.forbidden(
        'Tidak dapat menetapkan role owner melalui API',
        'OWNER_ROLE_NOT_ASSIGNABLE',
      );
    }

    const role = await this.roleRepo.findByOrganizationAndRoleName(
      organizationId,
      normalized,
    );

    if (!role) {
      throw BusinessError.unprocessable(
        `Role "${normalized}" tidak terdaftar di organisasi ini`,
        'UNKNOWN_ORG_ROLE',
      );
    }
  }

  private assertRoleName(role: string): void {
    const normalized = role.trim().toLowerCase();
    if (!normalized || normalized === RESERVED_OWNER) {
      throw BusinessError.unprocessable(
        'Nama role tidak valid',
        'INVALID_ROLE_NAME',
      );
    }
  }
}
