import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  let interceptor: ResponseEnvelopeInterceptor;

  beforeEach(() => {
    interceptor = new ResponseEnvelopeInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap response in envelope with correlationId', (done) => {
    const mockRequest = { correlationId: 'test-123' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ message: 'test data' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toEqual({ message: 'test data' });
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('timestamp');
      expect(result.meta).toHaveProperty('requestId', 'test-123');
      done();
    });
  });

  it('should handle request without correlationId', (done) => {
    const mockRequest = {};
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.meta.requestId).toBeUndefined();
      expect(typeof result.meta.timestamp).toBe('string');
      done();
    });
  });

  it('should flatten envelope data array and merge meta attributes for paginated response', (done) => {
    const mockRequest = { correlationId: 'paginated-123' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const paginatedPayload = {
      data: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    };

    const mockCallHandler: CallHandler = {
      handle: () => of(paginatedPayload),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        timestamp: expect.any(String),
        requestId: 'paginated-123',
      });
      done();
    });
  });
});
