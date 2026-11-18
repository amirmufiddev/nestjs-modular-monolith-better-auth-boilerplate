import { Test } from '@nestjs/testing';
import { MetricsModule } from './metrics.module';
import {
  HttpMetricsInterceptor,
  HTTP_REQUEST_DURATION_SECONDS,
} from './http-metrics.interceptor';

describe('MetricsModule', () => {
  it('should be defined', () => {
    expect(MetricsModule).toBeDefined();
  });

  it('should register HttpMetricsInterceptor via provider metadata', () => {
    const providers = Reflect.getMetadata('providers', MetricsModule) ?? [];
    const interceptorProvider = providers.find(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        'useClass' in p &&
        (p as { useClass: unknown }).useClass === HttpMetricsInterceptor,
    );
    expect(interceptorProvider).toBeDefined();
  });

  it('should expose http_request_duration_seconds histogram via Prometheus registry token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    const histogram = moduleRef.get(
      `PROM_METRIC_${HTTP_REQUEST_DURATION_SECONDS.toUpperCase()}`,
    );
    expect(histogram).toBeDefined();
    expect(typeof histogram.observe).toBe('function');
    expect(typeof histogram.labels).toBe('function');
    await moduleRef.close();
  });
});
