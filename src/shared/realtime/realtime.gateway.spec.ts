import { RealtimeGateway } from './realtime.gateway';
import { organizationRoom, userRoom } from './realtime.constants';
import * as realtimeAuthHelper from './realtime-auth.helper';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let mockPublisher: any;
  let mockLogger: any;
  let mockAuthService: any;
  let mockServer: any;
  let mockSocket: any;

  beforeEach(() => {
    mockPublisher = {
      setServer: jest.fn(),
    };
    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockAuthService = {
      api: {},
    };
    mockServer = {};
    mockSocket = {
      id: 'socket-123',
      handshake: {
        headers: {
          cookie: 'better-auth.session_token=valid',
        },
      },
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      data: {},
    };

    gateway = new RealtimeGateway(mockPublisher, mockLogger, mockAuthService);
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register server with RealtimePublisherService afterInit', () => {
    gateway.afterInit();
    expect(mockPublisher.setServer).toHaveBeenCalledWith(mockServer);
  });

  describe('handleConnection', () => {
    it('should disconnect client if resolveRealtimeAuth returns null', async () => {
      jest
        .spyOn(realtimeAuthHelper, 'resolveRealtimeAuth')
        .mockResolvedValue(null);

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should join organization room and set client data when auth is valid', async () => {
      jest.spyOn(realtimeAuthHelper, 'resolveRealtimeAuth').mockResolvedValue({
        userId: 'user-123',
        organizationId: 'org-456',
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith(organizationRoom('org-456'));
      expect(mockSocket.join).toHaveBeenCalledWith(userRoom('user-123'));
      expect(mockSocket.data.userId).toBe('user-123');
      expect(mockSocket.data.organizationId).toBe('org-456');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should log socket disconnection', () => {
      gateway.handleDisconnect(mockSocket);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Socket disconnected: socket-123',
        expect.objectContaining({
          context: 'RealtimeGateway',
          socketId: 'socket-123',
        }),
      );
    });
  });
});
