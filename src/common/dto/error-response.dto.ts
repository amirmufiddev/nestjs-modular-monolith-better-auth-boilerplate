import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: '2026-07-25T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/v1/members' })
  path!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ example: 'BadRequestError' })
  error!: string;

  @ApiPropertyOptional({ example: 'INVALID_INPUT' })
  code?: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  context?: Record<string, any> | null;

  @ApiProperty({ example: 'req-12345' })
  correlationId!: string;
}
