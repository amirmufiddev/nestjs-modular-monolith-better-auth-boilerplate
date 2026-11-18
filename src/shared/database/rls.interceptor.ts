import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RlsContext } from './rls-context';

interface SessionWithOrg {
  session?: { activeOrganizationId?: string };
}

@Injectable()
export class RlsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ session?: SessionWithOrg }>();
    const organizationId = req.session?.session?.activeOrganizationId ?? null;

    if (organizationId) {
      return new Observable((subscriber) => {
        RlsContext.run(organizationId, () => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        });
      });
    }

    return next.handle();
  }
}
