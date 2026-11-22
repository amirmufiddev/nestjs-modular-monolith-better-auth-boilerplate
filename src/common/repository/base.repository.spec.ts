import { BaseRepository, Tx } from './base.repository';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  PgColumn,
} from 'drizzle-orm/pg-core';

const dummyTable = pgTable('dummy', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id'),
  name: varchar('name'),
  phone: varchar('phone'),
  createdAt: timestamp('created_at'),
  deletedAt: timestamp('deleted_at'),
});

const dummyTableNoSoftDelete = pgTable('dummy_no_sd', {
  id: uuid('id').primaryKey(),
});

class DummyRepository extends BaseRepository<typeof dummyTable> {
  constructor(db: NodePgDatabase) {
    super(db, dummyTable);
  }

  listByOrganizationPaginated(
    organizationId: string,
    options: { search?: string; limit?: number; offset?: number },
  ) {
    return this.findPaginatedByOrganization(organizationId, options, {
      searchFields: [dummyTable.name as PgColumn, dummyTable.phone as PgColumn],
    });
  }
}

class DummyNoSoftDeleteRepository extends BaseRepository<
  typeof dummyTableNoSoftDelete
> {
  constructor(db: NodePgDatabase) {
    super(db, dummyTableNoSoftDelete);
  }
}

describe('BaseRepository', () => {
  let repository: DummyRepository;
  let dbMock: any;
  let selectMock: any;
  let fromMock: any;
  let whereMock: any;
  let limitMock: any;
  let updateMock: any;
  let setMock: any;

  beforeEach(() => {
    limitMock = jest.fn().mockResolvedValue([{ id: '1', deletedAt: null }]);
    whereMock = jest.fn().mockReturnValue({ limit: limitMock });
    fromMock = jest.fn().mockReturnValue({ where: whereMock });
    selectMock = jest.fn().mockReturnValue({ from: fromMock });

    setMock = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest
          .fn()
          .mockResolvedValue([{ id: '1', deletedAt: new Date() }]),
      }),
    });
    updateMock = jest.fn().mockReturnValue({ set: setMock });

    dbMock = {
      select: selectMock,
      update: updateMock,
    };

    repository = new DummyRepository(dbMock as unknown as NodePgDatabase);
  });

  describe('createMany', () => {
    it('should return empty array when data array is empty', async () => {
      const insertMock = jest.fn();
      dbMock.insert = insertMock;

      const result = await repository.createMany([]);
      expect(result).toEqual([]);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it('should insert multiple records using default db when tx is not provided', async () => {
      const recordsToInsert = [{ id: '1' }, { id: '2' }];
      const returningMock = jest.fn().mockResolvedValue(recordsToInsert);
      const valuesMock = jest
        .fn()
        .mockReturnValue({ returning: returningMock });
      const insertMock = jest.fn().mockReturnValue({ values: valuesMock });
      dbMock.insert = insertMock;

      const result = await repository.createMany(recordsToInsert);
      expect(result).toEqual(recordsToInsert);
      expect(dbMock.insert).toHaveBeenCalledWith(dummyTable);
      expect(valuesMock).toHaveBeenCalledWith(recordsToInsert);
      expect(returningMock).toHaveBeenCalled();
    });

    it('should insert multiple records using tx when tx is provided', async () => {
      const recordsToInsert = [{ id: '1' }, { id: '2' }];
      const returningMock = jest.fn().mockResolvedValue(recordsToInsert);
      const valuesMock = jest
        .fn()
        .mockReturnValue({ returning: returningMock });
      const insertMock = jest.fn().mockReturnValue({ values: valuesMock });
      const txMock = { insert: insertMock } as unknown as Tx;

      const result = await repository.createMany(recordsToInsert, txMock);
      expect(result).toEqual(recordsToInsert);
      expect(insertMock).toHaveBeenCalledWith(dummyTable);
      expect(valuesMock).toHaveBeenCalledWith(recordsToInsert);
      expect(returningMock).toHaveBeenCalled();
    });
  });

  it('should find by id', async () => {
    const result = await repository.findById('1');
    expect(result).toEqual({ id: '1', deletedAt: null });
    expect(dbMock.select).toHaveBeenCalled();
  });

  it('should find by id on table without deletedAt column without crashing', async () => {
    const noSdRepo = new DummyNoSoftDeleteRepository(
      dbMock as unknown as NodePgDatabase,
    );
    const result = await noSdRepo.findById('1');
    expect(result).toEqual({ id: '1', deletedAt: null });
    expect(dbMock.select).toHaveBeenCalled();
  });

  it('should soft delete', async () => {
    await repository.delete('1');
    expect(dbMock.update).toHaveBeenCalledWith(dummyTable);
  });

  describe('softDelete', () => {
    it('should return true when an active row is soft-deleted', async () => {
      const executeMock = jest.fn().mockResolvedValue([{ id: '1' }]);
      const returningMock = jest.fn().mockReturnValue({ execute: executeMock });
      const whereMockForSoftDelete = jest
        .fn()
        .mockReturnValue({ returning: returningMock });
      setMock.mockReturnValue({ where: whereMockForSoftDelete });

      await expect(repository.softDelete('1')).resolves.toBe(true);
      expect(dbMock.update).toHaveBeenCalledWith(dummyTable);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(whereMockForSoftDelete).toHaveBeenCalled();
      expect(returningMock).toHaveBeenCalledWith({ id: dummyTable.id });
    });

    it('should return false when no active row matches', async () => {
      const executeMock = jest.fn().mockResolvedValue([]);
      const returningMock = jest.fn().mockReturnValue({ execute: executeMock });
      const whereMockForSoftDelete = jest
        .fn()
        .mockReturnValue({ returning: returningMock });
      setMock.mockReturnValue({ where: whereMockForSoftDelete });

      await expect(repository.softDelete('missing')).resolves.toBe(false);
    });

    it('should return false for tables without deletedAt column', async () => {
      const noSdRepo = new DummyNoSoftDeleteRepository(
        dbMock as unknown as NodePgDatabase,
      );

      await expect(noSdRepo.softDelete('1')).resolves.toBe(false);
      expect(dbMock.update).not.toHaveBeenCalled();
    });
  });

  describe('findPaginatedByOrganization', () => {
    it('should query data and count in parallel with organizationId, deletedAt filter, search conditions, limit, offset and orderBy desc(createdAt)', async () => {
      const rows = [
        {
          id: '1',
          organizationId: 'organization-1',
          name: 'Test',
          phone: '123',
        },
      ];
      const countResult = [{ count: 1 }];

      const dataQueryChain: any = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(rows),
      };
      const dataFromMock = jest.fn().mockReturnValue(dataQueryChain);

      const countQueryChain: any = {
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(countResult),
      };
      const countFromMock = jest.fn().mockReturnValue(countQueryChain);

      let selectCalls = 0;
      dbMock.select = jest.fn().mockImplementation((_arg?: any) => {
        selectCalls++;
        if (selectCalls === 1) {
          return { from: dataFromMock };
        }
        return { from: countFromMock };
      });

      const result = await repository.listByOrganizationPaginated('org-1', {
        search: '  Test  ',
        limit: 10,
        offset: 5,
      });

      expect(result).toEqual({ data: rows, total: 1 });
      expect(dataQueryChain.limit).toHaveBeenCalledWith(10);
      expect(dataQueryChain.offset).toHaveBeenCalledWith(5);
      expect(dataQueryChain.orderBy).toHaveBeenCalled();
      expect(countQueryChain.where).toHaveBeenCalled();
    });
  });
});
