export const REALTIME_EVENT_PUBLISHER = Symbol('REALTIME_EVENT_PUBLISHER');

export interface RealtimeEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

export type RealtimeChannel =
  `admin:${string}` | `admin:${string}:${string}` | `org:${string}:admin`;
