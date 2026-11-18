import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PermissionScopeContext } from '../types/permission-scope.types';

/**
 * Parameter decorator to inject resolved permission scope into controller
 *
 * @example
 * async findAll(@PermissionScope() scope: PermissionScopeContext) { }
 */
export const PermissionScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PermissionScopeContext => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.permissionScope ?? {
        type: 'own',
        userId: request.session?.user?.id,
      }
    );
  },
);
