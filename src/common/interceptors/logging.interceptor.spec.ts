import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import { AppLoggerService } from '../../logger/logger.service';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockLogger: jest.Mocked<AppLoggerService>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;
    interceptor = new LoggingInterceptor(mockLogger);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log method, url, correlationId and duration after request', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/api/health/liveness',
      correlationId: 'test-correlation-id',
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ status: 'up' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      complete: () => {
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/health/liveness +'),
          'LoggingInterceptor',
          'test-correlation-id',
        );
        done();
      },
    });
  });

  it('should use "-" as correlationId when not present on request', (done) => {
    const mockRequest = {
      method: 'POST',
      url: '/api/auth/sign-in',
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({}),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      complete: () => {
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('POST /api/auth/sign-in +'),
          'LoggingInterceptor',
          '-',
        );
        done();
      },
    });
  });

  it('should log error when request fails', (done) => {
    const mockRequest = {
      method: 'GET',
      url: '/api/error-route',
      correlationId: 'err-id',
    };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => throwError(() => new Error('Test crash')),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err.message).toBe('Test crash');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/error-route - Failed +'),
          expect.any(String),
          'LoggingInterceptor',
          'err-id',
        );
        done();
      },
    });
  });
});
