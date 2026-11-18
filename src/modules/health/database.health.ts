import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.constants';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.pool.query('SELECT 1');
      return indicator.up();
    } catch (error: any) {
      return indicator.down({ message: error.message });
    }
  }
}
