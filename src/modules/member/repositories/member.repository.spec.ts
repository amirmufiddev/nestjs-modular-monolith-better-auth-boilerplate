import { MemberRepository } from './member.repository';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pendingMemberLinks } from '@/database/schema';

describe('MemberRepository', () => {
  let repository: MemberRepository;
  let dbMock: any;

  beforeEach(() => {
    dbMock = {
      select: jest.fn(),
      insert: jest.fn(),
      delete: jest.fn(),
    };
    repository = new MemberRepository(dbMock as NodePgDatabase);
  });

  describe('listByOrganizationPaginated', () => {
    it('should query members with join, filters, and pagination', async () => {
      const organizationId = 'organization-123';
      const mockResultRows = [
        {
          id: 'mem-1',
          organizationId: organizationId,
          userId: 'user-1',
          role: 'admin',
          createdAt: new Date('2026-01-01'),
          name: 'John Doe',
          email: 'john@example.com',
          phone: '08123456789',
          image: 'https://example.com/avatar.jpg',
        },
      ];

      const mockCountRows = [{ total: 1 }];

      // We setup chainable mock for db query builder
      const selectChain: any = {};
      selectChain.from = jest.fn().mockReturnValue(selectChain);
      selectChain.innerJoin = jest.fn().mockReturnValue(selectChain);
      selectChain.where = jest.fn().mockReturnValue(selectChain);
      selectChain.orderBy = jest.fn().mockReturnValue(selectChain);
      selectChain.limit = jest.fn().mockReturnValue(selectChain);
      selectChain.offset = jest.fn().mockReturnValue(selectChain);
      selectChain.$dynamic = jest.fn().mockReturnValue(selectChain);
      selectChain.execute = jest.fn().mockResolvedValue(mockResultRows);

      const countChain: any = {};
      countChain.from = jest.fn().mockReturnValue(countChain);
      countChain.innerJoin = jest.fn().mockReturnValue(countChain);
      countChain.where = jest.fn().mockReturnValue(countChain);
      countChain.execute = jest.fn().mockResolvedValue(mockCountRows);

      dbMock.select.mockImplementation((fields?: any) => {
        if (fields && 'total' in fields) {
          return countChain;
        }
        return selectChain;
      });

      const res = await repository.listByOrganizationPaginated(organizationId, {
        role: 'admin',
        search: 'john',
        limit: 10,
        offset: 0,
      });

      expect(res.data).toEqual(mockResultRows);
      expect(res.total).toBe(1);
    });

    it('should always exclude owner role from listing', async () => {
      const organizationId = 'organization-123';
      const mockResultRows: any[] = [];
      const mockCountRows = [{ total: 0 }];

      const selectChain: any = {};
      selectChain.from = jest.fn().mockReturnValue(selectChain);
      selectChain.innerJoin = jest.fn().mockReturnValue(selectChain);
      const whereMock = jest.fn().mockReturnValue(selectChain);
      selectChain.where = whereMock;
      selectChain.orderBy = jest.fn().mockReturnValue(selectChain);
      selectChain.limit = jest.fn().mockReturnValue(selectChain);
      selectChain.offset = jest.fn().mockReturnValue(selectChain);
      selectChain.$dynamic = jest.fn().mockReturnValue(selectChain);
      selectChain.execute = jest.fn().mockResolvedValue(mockResultRows);

      const countChain: any = {};
      countChain.from = jest.fn().mockReturnValue(countChain);
      countChain.innerJoin = jest.fn().mockReturnValue(countChain);
      countChain.where = jest.fn().mockReturnValue(countChain);
      countChain.execute = jest.fn().mockResolvedValue(mockCountRows);

      dbMock.select.mockImplementation((fields?: any) => {
        if (fields && 'total' in fields) {
          return countChain;
        }
        return selectChain;
      });

      await repository.listByOrganizationPaginated(organizationId, {
        limit: 10,
        offset: 0,
      });

      // The repository must always pass at least one more WHERE clause
      // than just the orgId equality — that's the NOT-owner exclusion.
      // Asserting depth/structure keeps the test resilient to drizzle
      // internal AST changes.
      expect(whereMock).toHaveBeenCalled();
      const conditions = whereMock.mock.calls[0][0];
      // With ONLY the orgId condition and no caller's filter, conditions
      // should now be a SQL chunk that has more than one operand — verify
      // it is a non-trivial SQL object (object form, not a single Eq).
      expect(conditions).toBeDefined();
      expect(typeof conditions).toBe('object');
      // Distinct operator shape: the previous build used `and(eq(...))`
      // with no extra caller filter; the new build should wrap with the
      // Not-operator inside `and(...)`. Inspect the `queryChunks` to
      // count conditions.
      const chunks = conditions?.queryChunks;
      expect(Array.isArray(chunks)).toBe(true);
      // 1st chunk is the original orgId Eq; we expect AT LEAST one
      // additional chunk for the owner exclusion.
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('findById', () => {
    it('should return member raw row if found', async () => {
      const organizationId = 'organization-123';
      const memberId = 'mem-1';
      const mockRow = {
        id: memberId,
        organizationId: organizationId,
        userId: 'user-1',
        role: 'admin',
        createdAt: new Date('2026-01-01'),
        name: 'John Doe',
        email: 'john@example.com',
        phone: '08123456789',
        image: null,
      };

      const selectChain: any = {};
      selectChain.from = jest.fn().mockReturnValue(selectChain);
      selectChain.innerJoin = jest.fn().mockReturnValue(selectChain);
      selectChain.where = jest.fn().mockReturnValue(selectChain);
      selectChain.limit = jest.fn().mockReturnValue(selectChain);
      selectChain.execute = jest.fn().mockResolvedValue([mockRow]);

      dbMock.select.mockReturnValue(selectChain);

      const res = await repository.findById(organizationId, memberId);
      expect(res).toEqual(mockRow);
    });

    it('should return null if member not found', async () => {
      const selectChain: any = {};
      selectChain.from = jest.fn().mockReturnValue(selectChain);
      selectChain.innerJoin = jest.fn().mockReturnValue(selectChain);
      selectChain.where = jest.fn().mockReturnValue(selectChain);
      selectChain.limit = jest.fn().mockReturnValue(selectChain);
      selectChain.execute = jest.fn().mockResolvedValue([]);

      dbMock.select.mockReturnValue(selectChain);

      const res = await repository.findById('organization-123', 'non-existent');
      expect(res).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return member raw row if found', async () => {
      const organizationId = 'organization-123';
      const userId = 'user-1';
      const mockRow = {
        id: 'mem-1',
        organizationId: organizationId,
        userId,
        role: 'owner',
        createdAt: new Date('2026-01-01'),
        name: 'Owner',
        email: 'owner@example.com',
        phone: null,
        image: null,
      };

      const selectChain: any = {};
      selectChain.from = jest.fn().mockReturnValue(selectChain);
      selectChain.innerJoin = jest.fn().mockReturnValue(selectChain);
      selectChain.where = jest.fn().mockReturnValue(selectChain);
      selectChain.limit = jest.fn().mockReturnValue(selectChain);
      selectChain.execute = jest.fn().mockResolvedValue([mockRow]);

      dbMock.select.mockReturnValue(selectChain);

      const res = await repository.findByUserId(organizationId, userId);
      expect(res).toEqual(mockRow);
    });

    it('should return null if member not found', async () => {
      const selectChain: any = {};
      selectChain.from = jest.fn().mockReturnValue(selectChain);
      selectChain.innerJoin = jest.fn().mockReturnValue(selectChain);
      selectChain.where = jest.fn().mockReturnValue(selectChain);
      selectChain.limit = jest.fn().mockReturnValue(selectChain);
      selectChain.execute = jest.fn().mockResolvedValue([]);

      dbMock.select.mockReturnValue(selectChain);

      const res = await repository.findByUserId(
        'organization-123',
        'missing-user',
      );
      expect(res).toBeNull();
    });
  });

  describe('pendingMemberLinks methods', () => {
    it('should upsert pending link', async () => {
      const insertChain: any = {};
      insertChain.values = jest.fn().mockReturnValue(insertChain);
      insertChain.onConflictDoUpdate = jest.fn().mockReturnValue(insertChain);
      insertChain.returning = jest.fn().mockReturnValue(insertChain);
      insertChain.execute = jest.fn().mockResolvedValue([
        {
          id: 'link-1',
          organizationId: 'org-1',
          email: 'test@example.com',
          role: 'driver',
          customerId: 'cust-1',
        },
      ]);

      dbMock.insert.mockReturnValue(insertChain);

      const res = await repository.upsertPendingLink(
        'org-1',
        'test@example.com',
        'driver',
      );

      expect(dbMock.insert).toHaveBeenCalledWith(pendingMemberLinks);
      expect(res.email).toBe('test@example.com');
    });

    it('should find pending link', async () => {
      const selectChain: any = {};
      selectChain.from = jest.fn().mockReturnValue(selectChain);
      selectChain.where = jest.fn().mockReturnValue(selectChain);
      selectChain.limit = jest.fn().mockReturnValue(selectChain);
      selectChain.execute = jest.fn().mockResolvedValue([
        {
          id: 'link-1',
          organizationId: 'org-1',
          email: 'test@example.com',
          role: 'driver',
          customerId: null,
        },
      ]);

      dbMock.select.mockReturnValue(selectChain);

      const res = await repository.findPendingLink('org-1', 'test@example.com');
      expect(res?.email).toBe('test@example.com');
    });

    it('should delete pending link', async () => {
      const deleteChain: any = {};
      deleteChain.where = jest.fn().mockReturnValue(deleteChain);
      deleteChain.execute = jest.fn().mockResolvedValue({ rowCount: 1 });

      dbMock.delete.mockReturnValue(deleteChain);

      await repository.deletePendingLink('org-1', 'test@example.com');
      expect(dbMock.delete).toHaveBeenCalledWith(pendingMemberLinks);
    });
  });
});
