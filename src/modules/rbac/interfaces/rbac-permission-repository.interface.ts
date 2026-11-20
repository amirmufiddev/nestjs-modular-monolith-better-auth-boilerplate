import type { NewRbacPermission, RbacPermission } from '@/database/schema';

export const RBAC_PERMISSION_REPOSITORY_TOKEN = Symbol(
  'RBAC_PERMISSION_REPOSITORY_TOKEN',
);

export interface IRbacPermissionRepository {
  findAllActive(): Promise<RbacPermission[]>;
  findByResourceAndAction(
    resource: string,
    action: string,
  ): Promise<RbacPermission | undefined>;
  findActiveById(id: string): Promise<RbacPermission | undefined>;
  createPermission(data: NewRbacPermission): Promise<RbacPermission>;
  updatePermission(
    id: string,
    data: Partial<
      Pick<
        RbacPermission,
        | 'actionDisplayName'
        | 'actionDescription'
        | 'resourceDisplayName'
        | 'resourceDescription'
      >
    >,
  ): Promise<RbacPermission | undefined>;
  softDelete(id: string): Promise<boolean>;
}
