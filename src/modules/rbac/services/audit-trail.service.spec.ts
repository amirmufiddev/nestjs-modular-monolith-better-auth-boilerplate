import { Test, TestingModule } from '@nestjs/testing';
import { AuditTrailService, LogAuditParams } from './audit-trail.service';
import {
  AUDIT_TRAIL_REPOSITORY_TOKEN,
  type IAuditTrailRepository,
} from '../interfaces';
import { AuditTrailLog } from '@/database/schema';

describe('AuditTrailService', () => {
  let service: AuditTrailService;
  let repository: jest.Mocked<IAuditTrailRepository>;

  const mockAuditLog: AuditTrailLog = {
    id: 'log-123',
    moduleKey: 'rbac',
    actorId: 'user-1',
    action: 'create',
    entityType: 'role',
    entityId: 'role-1',
    oldValue: null,
    newValue: { name: 'admin' },
    metadata: {},
    createdAt: new Date('2026-07-26T00:00:00.000Z'),
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      findMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditTrailService,
        {
          provide: AUDIT_TRAIL_REPOSITORY_TOKEN,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AuditTrailService>(AuditTrailService);
    repository = module.get(AUDIT_TRAIL_REPOSITORY_TOKEN);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should delegate create call to repository with correct parameters', async () => {
      repository.create.mockResolvedValue(mockAuditLog);

      const params: LogAuditParams = {
        moduleKey: 'member',
        actorId: 'user-1',
        action: 'create',
        entityType: 'member',
        entityId: 'mem-100',
        oldValue: undefined,
        newValue: { role: 'admin' },
        metadata: { source: 'api' },
      };

      const result = await service.log(params);

      expect(repository.create).toHaveBeenCalledWith({
        moduleKey: 'member',
        actorId: 'user-1',
        action: 'create',
        entityType: 'member',
        entityId: 'mem-100',
        oldValue: undefined,
        newValue: { role: 'admin' },
        metadata: { source: 'api' },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should default metadata to empty object if not provided', async () => {
      repository.create.mockResolvedValue(mockAuditLog);

      const params: LogAuditParams = {
        moduleKey: 'member',
        actorId: 'user-1',
        action: 'create',
        entityType: 'member',
        entityId: 'mem-100',
      };

      await service.log(params);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {},
        }),
      );
    });
  });

  describe('logRbacChange', () => {
    it('should call log method with moduleKey set to "rbac"', async () => {
      repository.create.mockResolvedValue(mockAuditLog);

      const result = await service.logRbacChange(
        'user-1',
        'update',
        'role',
        'role-1',
        { permissions: [] },
        { permissions: ['member:read'] },
        { reason: 'promotion' },
      );

      expect(repository.create).toHaveBeenCalledWith({
        moduleKey: 'rbac',
        actorId: 'user-1',
        action: 'update',
        entityType: 'role',
        entityId: 'role-1',
        oldValue: { permissions: [] },
        newValue: { permissions: ['member:read'] },
        metadata: { reason: 'promotion' },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('findByModule', () => {
    it('should query repository by moduleKey with limit and offset', async () => {
      repository.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.findByModule('rbac', 20, 10);

      expect(repository.findMany).toHaveBeenCalledWith({
        moduleKey: 'rbac',
        limit: 20,
        offset: 10,
      });
      expect(result).toEqual([mockAuditLog]);
    });

    it('should use default limit 50 and offset 0', async () => {
      repository.findMany.mockResolvedValue([mockAuditLog]);

      await service.findByModule('rbac');

      expect(repository.findMany).toHaveBeenCalledWith({
        moduleKey: 'rbac',
        limit: 50,
        offset: 0,
      });
    });
  });

  describe('findByEntity', () => {
    it('should query repository by entityType and entityId', async () => {
      repository.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.findByEntity('role', 'role-1');

      expect(repository.findMany).toHaveBeenCalledWith({
        entityType: 'role',
        entityId: 'role-1',
      });
      expect(result).toEqual([mockAuditLog]);
    });
  });
});
