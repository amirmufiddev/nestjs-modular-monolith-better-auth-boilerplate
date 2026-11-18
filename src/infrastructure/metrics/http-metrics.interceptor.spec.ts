import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let histogramObserve: jest.Mock;
  let mockHistogram: { observe: jest.Mock; labels: jest.Mock };

  const mockRequest = (
    overrides: Partial<{
      method: string;
      url: string;
      route: unknown;
      statusCode: number;
    }> = {},
  ) => ({
    method: 'GET',
    url: '/api/v1/orders',
    route: { path: '/api/v1/orders' },
    ...overrides,
  });

  const mockResponse = (overrides: Partial<{ statusCode: number }> = {}) => ({
    statusCode: 200,
    ...overrides,
  });

  const buildContext = (req: unknown, res: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    histogramObserve = jest.fn();
    mockHistogram = {
      observe: histogramObserve,
      labels: jest.fn().mockReturnValue({ observe: histogramObserve }),
    };
    interceptor = new HttpMetricsInterceptor(mockHistogram as any);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should record duration in seconds on successful response with method, route, and status_code labels', (done) => {
    const ctx = buildContext(mockRequest(), mockResponse({ statusCode: 200 }));
    const handler: CallHandler = {
      handle: () => of({ data: 'ok' }),
    };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(mockHistogram.labels).toHaveBeenCalledWith({
          method: 'GET',
          route: '/api/v1/orders',
          status_code: '200',
        });
        expect(histogramObserve).toHaveBeenCalledTimes(1);
        const observed = histogramObserve.mock.calls[0][0];
        expect(typeof observed).toBe('number');
        expect(observed).toBeGreaterThanOrEqual(0);
        done();
      },
    });
  });

  it('should record duration when handler emits an error using response status code', (done) => {
    const ctx = buildContext(
      mockRequest({ method: 'POST', route: { path: '/api/v1/auth' } }),
      mockResponse({ statusCode: 500 }),
    );
    const handler: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        expect(mockHistogram.labels).toHaveBeenCalledWith({
          method: 'POST',
          route: '/api/v1/auth',
          status_code: '500',
        });
        expect(histogramObserve).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('should fallback to "unknown" route when request route is missing', (done) => {
    const ctx = buildContext(
      mockRequest({ method: 'GET', url: '/api/v1/orders', route: undefined }),
      mockResponse({ statusCode: 200 }),
    );
    const handler: CallHandler = {
      handle: () => of({ data: 'ok' }),
    };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(mockHistogram.labels).toHaveBeenCalledWith({
          method: 'GET',
          route: 'unknown',
          status_code: '200',
        });
        done();
      },
    });
  });

  it('should rethrow the original error after recording the metric', (done) => {
    const ctx = buildContext(mockRequest(), mockResponse({ statusCode: 500 }));
    const handler: CallHandler = {
      handle: () => throwError(() => new Error('upstream failed')),
    };

    interceptor.intercept(ctx, handler).subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('upstream failed');
        expect(histogramObserve).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('should return the original payload unchanged on success', (done) => {
    const ctx = buildContext(mockRequest(), mockResponse({ statusCode: 200 }));
    const payload = { data: { id: 1 }, meta: { total: 1 } };
    const handler: CallHandler = {
      handle: () => of(payload),
    };

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual(payload);
      done();
    });
  });
});
