import { CorrelationIdMiddleware } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should use existing x-correlation-id header if present', () => {
    const correlationId = 'existing-id-123';
    const mockReq: any = {
      headers: { 'x-correlation-id': correlationId },
    };
    const mockRes: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    middleware.use(mockReq, mockRes, next);

    expect(mockReq.correlationId).toBe(correlationId);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      correlationId,
    );
    expect(next).toHaveBeenCalled();
  });

  it('should generate a new UUID if x-correlation-id header is absent', () => {
    const mockReq: any = {
      headers: {},
    };
    const mockRes: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    middleware.use(mockReq, mockRes, next);

    expect(mockReq.correlationId).toBeDefined();
    expect(typeof mockReq.correlationId).toBe('string');
    expect(mockReq.correlationId.length).toBeGreaterThan(0);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      mockReq.correlationId,
    );
    expect(next).toHaveBeenCalled();
  });
});
