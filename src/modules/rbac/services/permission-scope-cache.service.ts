import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PermissionScopeService } from './permission-scope.service';
import { CacheService } from '@/common/cache/cache.service';
import {
  PermissionScopeContext,
  ResolveParams,
} from '../types/permission-scope.types';
import { RBAC_SCOPE_KEY_PREFIX } from '../constants/rbac-cache.constants';

@Injectable()
export class PermissionScopeCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly scopeService: PermissionScopeService,
  ) {}

  /**
   * Resolve permission scope with Redis caching wrapper.
   */
  async resolveScope(params: ResolveParams): Promise<PermissionScopeContext> {
    const key = this.buildKey(params);

    try {
      const cached = await this.cacheService.get<PermissionScopeContext>(key);
      if (cached) {
        return cached;
      }
    } catch {
      // Silent fallback on cache get error
    }

    const scope = await this.scopeService.resolveScope(params);

    try {
      await this.cacheService.set(key, scope);
    } catch {
      // Silent fallback on cache set error
    }

    return scope;
  }

  /**
   * Create scope context for system jobs (delegates directly).
   */
  createSystemScope(): PermissionScopeContext {
    return this.scopeService.createSystemScope();
  }

  /**
   * Create scope context for user jobs (delegates directly).
   */
  async createUserScope(
    userId: string,
    orgId?: string,
    resource?: string,
    action?: string,
  ): Promise<PermissionScopeContext> {
    if (!orgId || !resource || !action) {
      return {
        type: 'own',
        userId,
      };
    }

    return this.resolveScope({
      userId,
      activeOrgId: orgId,
      resource,
      action,
    });
  }

  /**
   * Invalidate RBAC cache on organization/role update events.
   */
  @OnEvent('rbac.cache.invalidate')
  async handleInvalidateEvent(payload: {
    orgId?: string;
    userId?: string;
  }): Promise<void> {
    if (!payload?.orgId) return;

    try {
      // Key pattern invalidation for org scope
      const patternKey = `${RBAC_SCOPE_KEY_PREFIX}org:${payload.orgId}:*`;
      await this.cacheService.del(patternKey);
    } catch {
      // Silent fallback
    }
  }

  private buildKey(params: ResolveParams): string {
    const { userId, activeOrgId, resource, action } = params;
    const orgSegment = activeOrgId ?? 'none';
    return `${RBAC_SCOPE_KEY_PREFIX}org:${orgSegment}:user:${userId}:resource:${resource}:action:${action}`;
  }
}
