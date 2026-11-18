import { DatabaseHealthIndicator } from './database.health';
import { Pool } from 'pg';
import { HealthIndicatorService } from '@nestjs/terminus';

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;
  let mockPool: jest.Mocked<Pool>;
  let mockHealthIndicatorService: jest.Mocked<HealthIndicatorService>;
  let mockIndicator: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    } as any;

    mockIndicator = {
      up: jest.fn().mockReturnValue({ db: { status: 'up' } }),
      down: jest
        .fn()
        .mockImplementation((info) => ({ db: { status: 'down', ...info } })),
    };

    mockHealthIndicatorService = {
      check: jest.fn().mockReturnValue(mockIndicator),
    } as any;

    indicator = new DatabaseHealthIndicator(
      mockPool,
      mockHealthIndicatorService,
    );
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  it('should return status up when query succeeds', async () => {
    (mockPool.query as jest.Mock).mockResolvedValueOnce({} as any);

    const result = await indicator.isHealthy('db');
    expect(result).toEqual({ db: { status: 'up' } });
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('db');
    expect(mockIndicator.up).toHaveBeenCalled();
  });

  it('should return status down when query fails', async () => {
    (mockPool.query as jest.Mock).mockRejectedValueOnce(
      new Error('connection timeout'),
    );

    const result = await indicator.isHealthy('db');
    expect(result).toEqual({
      db: { status: 'down', message: 'connection timeout' },
    });
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('db');
    expect(mockIndicator.down).toHaveBeenCalledWith({
      message: 'connection timeout',
    });
  });
});
