import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { DatabaseHealthIndicator } from './database.health';
import { RedisHealthIndicator } from '@/common/health/redis.health';
import {
  LivenessResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dbHealth: DatabaseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Get('liveness')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Mengecek apakah aplikasi berjalan (liveness probe)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Aplikasi berjalan normal',
    type: LivenessResponseDto,
  })
  liveness(): LivenessResponseDto {
    return { status: 'up' };
  }

  @Get('readiness')
  @AllowAnonymous()
  @HealthCheck()
  @ApiOperation({
    summary: 'Mengecek kesiapan dependency aplikasi (database readiness probe)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Semua dependency sehat dan siap menerima traffic',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Salah satu dependency bermasalah atau tidak siap',
    type: ErrorResponseDto,
  })
  readiness() {
    return this.health.check([
      () => this.dbHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}
