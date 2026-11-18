import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppLoggerService } from '@/logger/logger.service';

@Injectable()
export class RedisHealthIndicator {
  private readonly client: Redis;

  constructor(
    config: ConfigService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly logger: AppLoggerService,
  ) {
    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: config.getOrThrow<number>('REDIS_PORT'),
      db: config.getOrThrow<number>('REDIS_DB'),
      password: config.get<string>('REDIS_PASSWORD'),
      lazyConnect: true,
      retryStrategy: () => null,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', () => {
      // Swallowed; surfaced in isHealthy() via HealthIndicatorService
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected ping response: ${pong}`);
      }
      return indicator.up();
    } catch (error: any) {
      this.logger.warn(
        `Redis health check failed: ${error.message}`,
        'RedisHealthIndicator',
      );
      return indicator.down({ message: error.message });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit().catch(() => {});
  }
}
