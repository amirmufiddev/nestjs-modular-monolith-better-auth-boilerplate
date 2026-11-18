import { Controller, Sse, Param, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { Observable } from 'rxjs';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { SseService } from './sse.service';
import { RealtimeChannel, RealtimeEvent } from './sse.constants';
import { BusinessError } from '@/common/errors/business-error';
import { SseHealthDto } from './dto/sse-health.dto';

@Controller('realtime')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('sse/:userId')
  stream(
    @Param('userId') userId: string,
    @Session() session: UserSession,
  ): Observable<RealtimeEvent> {
    if (session?.user?.id !== userId) {
      throw BusinessError.forbidden('Forbidden channel access');
    }
    return this.sseService.subscribe(`admin:${userId}` as RealtimeChannel);
  }

  @Get('health')
  @ApiOperation({ summary: 'Mengecek kesehatan layanan SSE realtime' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Layanan SSE berjalan normal',
    type: SseHealthDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Layanan SSE tidak tersedia',
    type: ErrorResponseDto,
  })
  healthCheck(): SseHealthDto {
    return {
      status: 'ok',
      activeConnections: this.sseService.getActiveConnectionCount(),
    };
  }
}
