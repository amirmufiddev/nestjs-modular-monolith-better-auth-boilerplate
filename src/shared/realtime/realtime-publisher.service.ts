import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { AppLoggerService } from '@/logger/logger.service';
import { organizationRoom, userRoom } from './realtime.constants';

@Injectable()
export class RealtimePublisherService {
  private server: Server | null = null;

  constructor(private readonly logger: AppLoggerService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  publishToOrganizationRoom(
    organizationId: string,
    event: string,
    payload: unknown,
  ): void {
    if (!this.server) {
      this.logger.warn(
        `WebSocket server not ready, skipping publish to room ${organizationRoom(organizationId)} for event ${event}`,
        {
          context: 'RealtimePublisherService',
          event,
          organizationId,
          room: organizationRoom(organizationId),
        },
      );
      return;
    }

    const room = organizationRoom(organizationId);
    this.server.to(room).emit(event, payload);
  }

  publishToUserRoom(userId: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(
        `WebSocket server not ready, skipping publish to room ${userRoom(userId)} for event ${event}`,
        {
          context: 'RealtimePublisherService',
          event,
          userId,
          room: userRoom(userId),
        },
      );
      return;
    }

    const room = userRoom(userId);
    this.server.to(room).emit(event, payload);
  }

  async hasConnectedClientInUserRoom(userId: string): Promise<boolean> {
    if (!this.server) {
      return false;
    }
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    return sockets.length > 0;
  }
}
