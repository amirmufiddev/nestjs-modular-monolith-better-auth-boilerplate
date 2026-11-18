export abstract class DomainEvent<T = unknown> {
  public readonly occurredAt: Date;

  constructor(public readonly payload: T) {
    this.occurredAt = new Date();
  }

  abstract get eventName(): string;
}

export interface EventMetadata {
  traceId?: string;
  userId?: string;
  organizationId?: string;
}

export function withMetadata<T>(
  event: DomainEvent<T>,
  metadata: EventMetadata,
): DomainEvent<T> {
  (event as DomainEvent<T> & EventMetadata).traceId = metadata.traceId;
  (event as DomainEvent<T> & EventMetadata).userId = metadata.userId;
  (event as DomainEvent<T> & EventMetadata).organizationId =
    metadata.organizationId;
  return event;
}
