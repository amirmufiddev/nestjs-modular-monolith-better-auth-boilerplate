import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Histogram } from 'prom-client';

export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION_SECONDS)
    private readonly httpDurationHistogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method?: string;
      url?: string;
      route?: { path?: string };
    }>();
    const res = http.getResponse<{ statusCode?: number }>();

    const method = req?.method ?? 'UNKNOWN';
    const route =
      req?.route && typeof req.route.path === 'string'
        ? req.route.path
        : 'unknown';
    const start = process.hrtime.bigint();
    const labels = { method, route, status_code: 'unknown' };

    return next.handle().pipe(
      tap({
        next: () => {
          this.observe(labels, start, res?.statusCode);
        },
        error: () => {
          this.observe(labels, start, res?.statusCode);
        },
      }),
    );
  }

  private observe(
    labels: { method: string; route: string; status_code: string },
    start: bigint,
    statusCode: number | undefined,
  ): void {
    const elapsedSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    this.httpDurationHistogram
      .labels({ ...labels, status_code: String(statusCode ?? 'unknown') })
      .observe(elapsedSeconds);
  }
}
