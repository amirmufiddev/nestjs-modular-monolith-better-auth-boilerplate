export const REALTIME_WS_NAMESPACE = '/ws';

export function organizationRoom(organizationId: string): string {
  return `org:${organizationId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
