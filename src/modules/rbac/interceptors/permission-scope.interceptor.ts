import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { SCOPE_META_KEY } from '../decorators/require-permission.decorator';
import { PermissionScopeCacheService } from '../services/permission-scope-cache.service';
import {
  ScopeMeta,
  PermissionScopeContext,
} from '../types/permission-scope.types';

@Injectable()
export class PermissionScopeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly scopeCacheService: PermissionScopeCacheService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const meta = this.reflector.get<ScopeMeta>(
      SCOPE_META_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const session = request?.session;

    if (!meta || !session?.user) {
      request.permissionScope = {
        type: 'own',
        userId: session?.user?.id ?? 'anonymous',
      } as PermissionScopeContext;
      return next.handle();
    }

    const scope = await this.scopeCacheService.resolveScope({
      userId: session.user.id,
      userRole: session.user.role,
      activeOrgId: session.session?.activeOrganizationId,
      resource: meta.resource,
      action: meta.action,
    });

    request.permissionScope = scope;

    return next.handle();
  }
}
