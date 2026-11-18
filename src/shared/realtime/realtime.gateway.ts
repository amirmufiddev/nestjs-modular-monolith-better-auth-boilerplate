import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { AppLoggerService } from '@/logger/logger.service';
import {
  REALTIME_WS_NAMESPACE,
  organizationRoom,
  userRoom,
} from './realtime.constants';
import { RealtimePublisherService } from './realtime-publisher.service';
import { resolveRealtimeAuth } from './realtime-auth.helper';

@WebSocketGateway({
  namespace: REALTIME_WS_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly publisher: RealtimePublisherService,
    private readonly logger: AppLoggerService,
    private readonly authService: AuthService,
  ) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized on namespace /ws', {
      context: 'RealtimeGateway',
      namespace: REALTIME_WS_NAMESPACE,
    });
    this.publisher.setServer(this.server);
  }

  async handleConnection(client: Socket): Promise<void> {
    this.logger.debug(
      `Socket connection attempt: ${client.id}, cookie present: ${!!client.handshake.headers.cookie}`,
      {
        context: 'RealtimeGateway',
        socketId: client.id,
        cookiePresent: !!client.handshake.headers.cookie,
      },
    );

    const auth = await resolveRealtimeAuth(
      client.handshake.headers.cookie,
      this.authService,
    );

    if (!auth) {
      this.logger.warn(
        `Socket connection rejected (unauthorized): ${client.id}`,
        {
          context: 'RealtimeGateway',
          socketId: client.id,
        },
      );
      client.disconnect(true);
      return;
    }

    await client.join(organizationRoom(auth.organizationId));
    await client.join(userRoom(auth.userId));
    client.data.userId = auth.userId;
    client.data.organizationId = auth.organizationId;
    this.logger.debug(
      `Socket connected: ${client.id} (user: ${auth.userId}, organization: ${auth.organizationId})`,
      {
        context: 'RealtimeGateway',
        socketId: client.id,
        userId: auth.userId,
        organizationId: auth.organizationId,
      },
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`, {
      context: 'RealtimeGateway',
      socketId: client.id,
    });
  }
}
