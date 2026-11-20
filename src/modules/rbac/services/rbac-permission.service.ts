import { Inject, Injectable } from '@nestjs/common';
import { BusinessError } from '@/common/errors/business-error';
import type { RbacPermission } from '@/database/schema';
import {
  RBAC_PERMISSION_REPOSITORY_TOKEN,
  type IRbacPermissionRepository,
} from '../interfaces/rbac-permission-repository.interface';
import {
  buildAllPermissionCodes,
  buildPermissionCatalogView,
} from '../utils/rbac-permission.mapper';
import type { CreateRbacPermissionDto } from '../dto/create-rbac-permission.dto';
import type { UpdateRbacPermissionDto } from '../dto/update-rbac-permission.dto';

const RESOURCE_PATTERN = /^[a-z][a-z0-9-]*$/;
const ACTION_PATTERN = /^[a-z][a-z0-9-]*$/;

@Injectable()
export class RbacPermissionService {
  constructor(
    @Inject(RBAC_PERMISSION_REPOSITORY_TOKEN)
    private readonly permissionRepo: IRbacPermissionRepository,
  ) {}

  async getCatalog() {
    const rows = await this.permissionRepo.findAllActive();
    return buildPermissionCatalogView(rows);
  }

  async getPermissionCodes(): Promise<string[]> {
    const rows = await this.permissionRepo.findAllActive();
    return buildAllPermissionCodes(rows);
  }

  async getById(id: string): Promise<RbacPermission> {
    const row = await this.permissionRepo.findActiveById(id);
    if (!row) {
      throw BusinessError.notFound('Permission', id);
    }
    return row;
  }

  async create(dto: CreateRbacPermissionDto): Promise<RbacPermission> {
    this.assertSlug('resource', dto.resource, RESOURCE_PATTERN);
    this.assertSlug('action', dto.action, ACTION_PATTERN);

    const existing = await this.permissionRepo.findByResourceAndAction(
      dto.resource,
      dto.action,
    );
    if (existing) {
      throw BusinessError.conflict(
        `Permission ${dto.resource}:${dto.action} sudah ada`,
        'PERMISSION_EXISTS',
      );
    }

    return this.permissionRepo.createPermission({
      resource: dto.resource,
      action: dto.action,
      actionDisplayName: dto.actionDisplayName,
      actionDescription: dto.actionDescription,
      resourceDisplayName: dto.resourceDisplayName,
      resourceDescription: dto.resourceDescription,
    });
  }

  async update(
    id: string,
    dto: UpdateRbacPermissionDto,
  ): Promise<RbacPermission> {
    await this.getById(id);

    const updated = await this.permissionRepo.updatePermission(id, {
      actionDisplayName: dto.actionDisplayName,
      actionDescription: dto.actionDescription,
      resourceDisplayName: dto.resourceDisplayName,
      resourceDescription: dto.resourceDescription,
    });

    if (!updated) {
      throw BusinessError.notFound('Permission', id);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    const deleted = await this.permissionRepo.softDelete(id);
    if (!deleted) {
      throw BusinessError.notFound('Permission', id);
    }
  }

  private assertSlug(field: string, value: string, pattern: RegExp): void {
    if (!pattern.test(value)) {
      throw BusinessError.unprocessable(
        `${field} harus lowercase alfanumerik dengan strip (contoh: update-role)`,
        'INVALID_PERMISSION_SLUG',
      );
    }
  }
}
