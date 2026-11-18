// Type-safe event registry.
// Modul akan extend interface ini dengan moduleName-nya sendiri.

export interface DomainEventMap {
  'app.heartbeat': { timestamp: number };
}

export type EventPayload<K extends keyof DomainEventMap> = DomainEventMap[K];

export type EventName<N extends string, A extends string> = `${N}.${A}`;
