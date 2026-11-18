import { Test } from '@nestjs/testing';
import { SseService } from './sse.service';
import { RealtimeChannel } from './sse.constants';
import { AppLoggerService } from '@/logger/logger.service';

describe('SseService', () => {
  let service: SseService;

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SseService,
        { provide: AppLoggerService, useValue: mockLogger },
      ],
    }).compile();
    service = moduleRef.get(SseService);
  });

  it('should subscribe to a channel and receive published events', (done) => {
    const channel: RealtimeChannel = 'admin:user-1';
    const stream$ = service.subscribe(channel);

    stream$.subscribe((event) => {
      expect(event.type).toBe('order.created');
      expect(event.data).toEqual({ orderId: 'o-1' });
      done();
    });

    service.publishToChannel(channel, {
      type: 'order.created',
      data: { orderId: 'o-1' },
      timestamp: Date.now(),
    });
  });

  it('should publish to all admins of an organization', (done) => {
    let receivedCount = 0;
    const targetCount = 2;

    const channel1: RealtimeChannel = 'admin:user-1:org-1';
    const channel2: RealtimeChannel = 'admin:user-2:org-1';

    const stream1$ = service.subscribe(channel1);
    const stream2$ = service.subscribe(channel2);

    stream1$.subscribe((event) => {
      expect(event.type).toBe('inventory.low');
      receivedCount++;
      if (receivedCount === targetCount) done();
    });

    stream2$.subscribe((event) => {
      expect(event.type).toBe('inventory.low');
      receivedCount++;
      if (receivedCount === targetCount) done();
    });

    service.publishToOrganizationAdmins('org-1', {
      type: 'inventory.low',
      data: { variantId: 'v-19l' },
      timestamp: Date.now(),
    });
  });

  it('should return empty observable for unknown user', (done) => {
    const stream$ = service.subscribe('admin:unknown');
    let emitted = false;
    stream$.subscribe(() => {
      emitted = true;
    });

    setImmediate(() => {
      expect(emitted).toBe(false);
      done();
    });
  });

  it('should unsubscribe user and cleanup subject', () => {
    service.subscribe('admin:user-1');
    expect(service.getActiveConnectionCount()).toBe(1);

    service.unsubscribe('admin:user-1');
    expect(service.getActiveConnectionCount()).toBe(0);
  });
});
