import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LivenessResponseDto {
  @ApiProperty({ example: 'up' })
  status!: string;
}

export class HealthCheckDetailDto {
  @ApiProperty({ example: 'up' })
  status!: string;
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiPropertyOptional({
    example: {
      database: { status: 'up' },
    },
  })
  info?: Record<string, HealthCheckDetailDto>;

  @ApiPropertyOptional({ example: {} })
  error?: Record<string, HealthCheckDetailDto>;

  @ApiProperty({
    example: {
      database: { status: 'up' },
    },
  })
  details!: Record<string, HealthCheckDetailDto>;
}
