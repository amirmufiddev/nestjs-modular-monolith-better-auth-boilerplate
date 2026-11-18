import { EventPayload, EventName } from './domain-event-registry';

describe('DomainEventRegistry', () => {
  it('should compile and map heartbeat payload correctly', () => {
    const heartbeatPayload: EventPayload<'app.heartbeat'> = {
      timestamp: 1234567890,
    };
    expect(heartbeatPayload.timestamp).toBe(1234567890);
  });

  it('should allow module augmentation for domain event map', () => {
    type TestEventName = EventName<'order', 'created'>;
    const eventName: TestEventName = 'order.created';
    expect(eventName).toBe('order.created');
  });
});
