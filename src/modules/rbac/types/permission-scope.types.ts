export type ScopeType = 'global' | 'organization' | 'outlet' | 'own';

export interface PermissionScopeContext {
  type: ScopeType;
  userId: string;
  orgId?: string;
  outletId?: string;
  activeOrgId?: string;
}

export interface ScopeMeta {
  resource: string;
  action: string;
}

export interface ResolveParams {
  userId: string;
  userRole?: string | string[];
  activeOrgId?: string;
  resource: string;
  action: string;
}
