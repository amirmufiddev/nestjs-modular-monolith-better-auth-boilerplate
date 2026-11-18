// Mock the Better Auth decorator before importing the controller
jest.mock('@thallesp/nestjs-better-auth', () => ({
  Public: () => jest.fn(),
  AllowAnonymous: () => jest.fn(),
}));

import { HealthController } from './health.controller';
import { HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';
import { RedisHealthIndicator } from '@/common/health/redis.health';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealth: jest.Mocked<HealthCheckService>;
  let mockDbHealth: jest.Mocked<DatabaseHealthIndicator>;
  let mockRedisHealth: jest.Mocked<RedisHealthIndicator>;

  beforeEach(() => {
    mockHealth = {
      check: jest.fn().mockImplementation((indicators) => {
        // Evaluate indicator functions to make sure they run without error
        indicators.forEach((ind: any) => ind());
        return Promise.resolve({
          status: 'ok',
          info: { database: { status: 'up' }, redis: { status: 'up' } },
        });
      }),
    } as any;

    mockDbHealth = {
      isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    } as any;

    mockRedisHealth = {
      isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
    } as any;

    controller = new HealthController(
      mockHealth,
      mockDbHealth,
      mockRedisHealth,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return status up for liveness', () => {
    const result = controller.liveness();
    expect(result).toEqual({ status: 'up' });
  });

  it('should check db status for readiness', async () => {
    const result = await controller.readiness();
    expect(mockHealth.check).toHaveBeenCalled();
    expect(mockDbHealth.isHealthy).toHaveBeenCalledWith('database');
    expect(mockRedisHealth.isHealthy).toHaveBeenCalledWith('redis');
    expect(result).toEqual({
      status: 'ok',
      info: { database: { status: 'up' }, redis: { status: 'up' } },
    });
  });
});
