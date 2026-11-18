import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';
import { AppLoggerService } from '@/logger/logger.service';
import { organizationRoom, userRoom } from './realtime.constants';
import { RealtimePublisherService } from './realtime-publisher.service';

describe('RealtimePublisherService', () => {
  let service: RealtimePublisherService;
  let mockLogger: {
    log: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimePublisherService,
        { provide: AppLoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<RealtimePublisherService>(RealtimePublisherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishToOrganizationRoom', () => {
    it('should call server.to(room).emit(event, payload) when server is set', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = {
        to: mockTo,
      } as unknown as Server;

      service.setServer(mockServer);

      const organizationId = 'org-1';
      const event = 'member.updated';
      const payload = { id: 'member-123' };

      service.publishToOrganizationRoom(organizationId, event, payload);

      expect(mockTo).toHaveBeenCalledWith(organizationRoom(organizationId));
      expect(mockEmit).toHaveBeenCalledWith(event, payload);
    });

    it('should log warn when server is null (not ready)', () => {
      const organizationId = 'org-1';
      const event = 'member.updated';
      const payload = { id: 'member-123' };

      expect(() => {
        service.publishToOrganizationRoom(organizationId, event, payload);
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket server not ready'),
        expect.objectContaining({
          context: 'RealtimePublisherService',
          organizationId,
          room: organizationRoom(organizationId),
          event,
        }),
      );
    });
  });

  describe('publishToUserRoom', () => {
    it('should call server.to(room).emit(event, payload) when server is set', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = {
        to: mockTo,
      } as unknown as Server;

      service.setServer(mockServer);

      const userId = 'user-1';
      const event = 'notification.new';
      const payload = { id: 'notif-123' };

      service.publishToUserRoom(userId, event, payload);

      expect(mockTo).toHaveBeenCalledWith(userRoom(userId));
      expect(mockEmit).toHaveBeenCalledWith(event, payload);
    });

    it('should log warn when server is null (not ready)', () => {
      const userId = 'user-1';
      const event = 'notification.new';
      const payload = { id: 'notif-123' };

      expect(() => {
        service.publishToUserRoom(userId, event, payload);
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket server not ready'),
        expect.objectContaining({
          context: 'RealtimePublisherService',
          userId,
          room: userRoom(userId),
          event,
        }),
      );
    });
  });

  describe('hasConnectedClientInUserRoom', () => {
    it('should return false when server is not set', async () => {
      await expect(
        service.hasConnectedClientInUserRoom('user-1'),
      ).resolves.toBe(false);
    });

    it('should return true when fetchSockets length > 0', async () => {
      const fetchSockets = jest.fn().mockResolvedValue([{ id: 's1' }]);
      const mockIn = jest.fn().mockReturnValue({ fetchSockets });
      service.setServer({ in: mockIn } as unknown as Server);
      await expect(
        service.hasConnectedClientInUserRoom('user-1'),
      ).resolves.toBe(true);
      expect(mockIn).toHaveBeenCalledWith(userRoom('user-1'));
    });

    it('should return false when fetchSockets is empty', async () => {
      const fetchSockets = jest.fn().mockResolvedValue([]);
      const mockIn = jest.fn().mockReturnValue({ fetchSockets });
      service.setServer({ in: mockIn } as unknown as Server);
      await expect(
        service.hasConnectedClientInUserRoom('user-1'),
      ).resolves.toBe(false);
    });
  });
});
