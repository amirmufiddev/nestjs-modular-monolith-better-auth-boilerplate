import { Test, TestingModule } from '@nestjs/testing';
import { AuditTrailRepository } from './audit-trail.repository';
import { DRIZZLE } from '@/database/database.constants';
import * as schema from '@/database/schema';

describe('AuditTrailRepository', () => {
  let repository: AuditTrailRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 'test-uuid',
              moduleKey: 'rbac',
              actorId: 'user-1',
              action: 'create',
              entityType: 'role',
              entityId: 'role-1',
              oldValue: null,
              newValue: { name: 'admin' },
              metadata: {},
              createdAt: new Date('2026-07-26T00:00:00.000Z'),
            },
          ]),
        }),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                offset: jest.fn().mockResolvedValue([
                  {
                    id: 'test-uuid',
                    moduleKey: 'rbac',
                    actorId: 'user-1',
                    action: 'create',
                    entityType: 'role',
                    entityId: 'role-1',
                    oldValue: null,
                    newValue: { name: 'admin' },
                    metadata: {},
                    createdAt: new Date('2026-07-26T00:00:00.000Z'),
                  },
                ]),
              }),
            }),
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditTrailRepository,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<AuditTrailRepository>(AuditTrailRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should insert audit trail log and return created log', async () => {
      const data: any = {
        moduleKey: 'rbac',
        actorId: 'user-1',
        action: 'create',
        entityType: 'role',
        entityId: 'role-1',
        newValue: { name: 'admin' },
      };

      const result = await repository.create(data);

      expect(mockDb.insert).toHaveBeenCalledWith(schema.auditTrailLogs);
      expect(result).toEqual({
        id: 'test-uuid',
        moduleKey: 'rbac',
        actorId: 'user-1',
        action: 'create',
        entityType: 'role',
        entityId: 'role-1',
        oldValue: null,
        newValue: { name: 'admin' },
        metadata: {},
        createdAt: expect.any(Date),
      });
    });
  });

  describe('findMany', () => {
    it('should query audit trail logs with filter parameters', async () => {
      const params = {
        moduleKey: 'rbac',
        actorId: 'user-1',
        entityType: 'role',
        entityId: 'role-1',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-31'),
        limit: 10,
        offset: 0,
      };

      const result = await repository.findMany(params);

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });
});
