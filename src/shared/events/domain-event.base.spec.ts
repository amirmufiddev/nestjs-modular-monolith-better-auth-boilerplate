import { DomainEvent, withMetadata } from './domain-event.base';

class DummyEvent extends DomainEvent<{ message: string }> {
  get eventName(): string {
    return 'dummy.event';
  }
}

describe('DomainEvent', () => {
  it('should instantiate event with payload and set occurredAt timestamp', () => {
    const payload = { message: 'hello' };
    const event = new DummyEvent(payload);

    expect(event.payload).toEqual(payload);
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.eventName).toBe('dummy.event');
  });

  it('should attach metadata using withMetadata helper', () => {
    const event = new DummyEvent({ message: 'test' });
    const metadata = {
      traceId: 'trace-123',
      userId: 'user-456',
      organizationId: 'org-789',
    };

    const enrichedEvent = withMetadata(event, metadata);

    expect(enrichedEvent).toBe(event);
    expect((enrichedEvent as any).traceId).toBe('trace-123');
    expect((enrichedEvent as any).userId).toBe('user-456');
    expect((enrichedEvent as any).organizationId).toBe('org-789');
  });
});
