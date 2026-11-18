import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      map((payload) => {
        // ponytail: assumes shape { data: Array, meta: Object } is a paginated response. Upgrade path: check instanceof PaginatedResponseDto if non-paginated payloads share this structure.
        const isPaginated =
          payload !== null &&
          typeof payload === 'object' &&
          Array.isArray(payload.data) &&
          payload.meta !== null &&
          typeof payload.meta === 'object';

        const envelopeMeta = {
          timestamp: new Date().toISOString(),
          requestId: req?.correlationId,
        };

        if (isPaginated) {
          return {
            success: true,
            data: payload.data,
            meta: {
              ...payload.meta,
              ...envelopeMeta,
            },
          };
        }

        return {
          success: true,
          data: payload,
          meta: envelopeMeta,
        };
      }),
    );
  }
}
