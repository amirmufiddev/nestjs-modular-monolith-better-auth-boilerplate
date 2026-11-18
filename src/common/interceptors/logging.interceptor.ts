import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppLoggerService } from '../../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    const url = req.url as string;
    const correlationId = (req.correlationId ?? '-') as string;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${url} +${duration}ms`,
            'LoggingInterceptor',
            correlationId,
          );
        },
        error: (err: any) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${method} ${url} - Failed +${duration}ms. Error: ${(err?.message || err) as string}`,
            err?.stack as string,
            'LoggingInterceptor',
            correlationId,
          );
        },
      }),
    );
  }
}
