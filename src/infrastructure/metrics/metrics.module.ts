import { Module, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import {
  HttpMetricsInterceptor,
  HTTP_REQUEST_DURATION_SECONDS,
} from './http-metrics.interceptor';

const httpDurationHistogramProvider: Provider = makeHistogramProvider({
  name: HTTP_REQUEST_DURATION_SECONDS,
  help: 'HTTP request duration in seconds, labeled by method, route, and status code',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    httpDurationHistogramProvider,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [PrometheusModule, httpDurationHistogramProvider],
})
export class MetricsModule {}
