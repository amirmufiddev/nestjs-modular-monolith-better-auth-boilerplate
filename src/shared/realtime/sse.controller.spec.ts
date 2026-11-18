import { Test } from '@nestjs/testing';
import { DECORATORS } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';
import { SseHealthDto } from './dto/sse-health.dto';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import { firstValueFrom, of } from 'rxjs';
import { BusinessError } from '@/common/errors/business-error';
import type { UserSession } from '@thallesp/nestjs-better-auth';

function getApiResponseType(
  handler: (...args: unknown[]) => unknown,
  status: number,
) {
  const metadata = Reflect.getMetadata(DECORATORS.API_RESPONSE, handler);
  return metadata?.[status]?.type;
}

describe('SseController', () => {
  let controller: SseController;
  let sseService: jest.Mocked<SseService>;

  const mockSession = {
    user: {
      id: 'user-1',
      email: 'user1@example.com',
      name: 'User 1',
    },
    session: {
      id: 'session-1',
      userId: 'user-1',
    },
  } as unknown as UserSession;

  beforeEach(async () => {
    const mockSse = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getActiveConnectionCount: jest.fn(),
    } as unknown as jest.Mocked<SseService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [SseController],
      providers: [{ provide: SseService, useValue: mockSse }],
    }).compile();

    controller = moduleRef.get(SseController);
    sseService = moduleRef.get(SseService);
  });

  it('should subscribe user to their channel and return observable', async () => {
    const mockObs = of({ type: 'test', data: {}, timestamp: 1 });
    sseService.subscribe.mockReturnValue(mockObs);

    const result = controller.stream('user-1', mockSession);
    expect(sseService.subscribe).toHaveBeenCalledWith('admin:user-1');
    expect(await firstValueFrom(result)).toEqual({
      type: 'test',
      data: {},
      timestamp: 1,
    });
  });

  it('should throw 403 Forbidden if userId does not match session user id', () => {
    expect(() => controller.stream('user-2', mockSession)).toThrow(
      BusinessError.forbidden('Forbidden channel access'),
    );
    expect(sseService.subscribe).not.toHaveBeenCalled();
  });

  it('should return health check with active connection count', () => {
    sseService.getActiveConnectionCount.mockReturnValue(5);

    const result = controller.healthCheck();
    expect(result).toEqual({ status: 'ok', activeConnections: 5 });
    expect(sseService.getActiveConnectionCount).toHaveBeenCalled();
  });

  describe('OpenAPI metadata', () => {
    it('should document health endpoint responses', () => {
      const operation = Reflect.getMetadata(
        DECORATORS.API_OPERATION,
        controller.healthCheck,
      );
      expect(operation?.summary).toBe(
        'Mengecek kesehatan layanan SSE realtime',
      );
      expect(getApiResponseType(controller.healthCheck, HttpStatus.OK)).toBe(
        SseHealthDto,
      );
      expect(
        getApiResponseType(
          controller.healthCheck,
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      ).toBe(ErrorResponseDto);
    });
  });
});
