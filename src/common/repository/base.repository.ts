import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  isNull,
  and,
  or,
  ilike,
  InferSelectModel,
  SQL,
  count,
  desc,
} from 'drizzle-orm';
import {
  PgTableWithColumns,
  PgColumn,
  PgTransaction,
  PgTable,
} from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../../database/database.constants';

/** Type helper untuk transaction callback parameter. */
export type Tx = PgTransaction<any, any, any> | NodePgDatabase<any>;
export type TableData = Record<string, any>;

@Injectable()
export abstract class BaseRepository<TTable extends PgTableWithColumns<any>> {
  constructor(
    @Inject(DRIZZLE) protected readonly db: NodePgDatabase,
    protected readonly table: TTable,
  ) {}

  private buildSoftDeleteCondition(): SQL | undefined {
    const tableWithSoftDelete = this.table as Record<string, unknown>;
    if ('deletedAt' in this.table && tableWithSoftDelete.deletedAt) {
      return isNull(tableWithSoftDelete.deletedAt as PgColumn);
    }
    return undefined;
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    where?: SQL;
    orderBy?: SQL;
  }): Promise<InferSelectModel<TTable>[]> {
    const conditions: SQL[] = [];
    const sdCondition = this.buildSoftDeleteCondition();
    if (sdCondition) conditions.push(sdCondition);
    if (options?.where) conditions.push(options.where);

    let query = this.db
      .select()
      .from(this.table as PgTable)
      .orderBy(options?.orderBy ?? desc((this.table as any).createdAt))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const results = await query.execute();
    return results as InferSelectModel<TTable>[];
  }

  async findPaginated(options?: {
    limit?: number;
    page?: number;
    where?: SQL;
    orderBy?: SQL;
  }): Promise<{ data: InferSelectModel<TTable>[]; total: number }> {
    const offset = ((options?.page ?? 1) - 1) * (options?.limit ?? 20);
    const conditions: SQL[] = [];
    const sdCondition = this.buildSoftDeleteCondition();
    if (sdCondition) conditions.push(sdCondition);
    if (options?.where) conditions.push(options.where);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let query = this.db
      .select()
      .from(this.table as PgTable)
      .orderBy(options?.orderBy ?? desc((this.table as any).createdAt))
      .$dynamic();

    if (whereClause) {
      query = query.where(whereClause);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (offset) {
      query = query.offset(offset);
    }

    const countQuery = this.db
      .select({ count: count() })
      .from(this.table as PgTable);

    const [data, totalResult] = await Promise.all([
      query.execute(),
      (whereClause ? countQuery.where(whereClause) : countQuery).execute(),
    ]);

    return {
      data: data as InferSelectModel<TTable>[],
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async findPaginatedByOrganization(
    organizationId: string,
    options?: {
      search?: string;
      limit?: number;
      offset?: number;
    },
    searchConfig?: {
      searchFields?: PgColumn[];
      extraWhere?: SQL;
    },
  ): Promise<{ data: InferSelectModel<TTable>[]; total: number }> {
    const conditions: SQL[] = [
      eq((this.table as any).organizationId, organizationId),
    ];
    const sdCondition = this.buildSoftDeleteCondition();
    if (sdCondition) conditions.push(sdCondition);

    const trimmedSearch = options?.search?.trim();
    if (
      trimmedSearch &&
      searchConfig?.searchFields &&
      searchConfig.searchFields.length > 0
    ) {
      const searchPattern = `%${trimmedSearch}%`;
      const searchConditions = searchConfig.searchFields.map((field) =>
        ilike(field, searchPattern),
      );
      const searchCondition =
        searchConditions.length === 1
          ? searchConditions[0]
          : or(...searchConditions);
      if (searchCondition) conditions.push(searchCondition);
    }

    if (searchConfig?.extraWhere) {
      conditions.push(searchConfig.extraWhere);
    }

    const whereClause = and(...conditions);

    const dataBase = this.db.select().from(this.table as PgTable);
    const dataQuery = whereClause ? dataBase.where(whereClause) : dataBase;
    const orderedDataQuery = dataQuery.orderBy(
      desc((this.table as any).createdAt),
    );
    const limitedDataQuery =
      options?.limit !== undefined
        ? orderedDataQuery.limit(options.limit)
        : orderedDataQuery;
    const paginatedDataQuery =
      options?.offset !== undefined
        ? limitedDataQuery.offset(options.offset)
        : limitedDataQuery;

    const countBase = this.db
      .select({ count: count() })
      .from(this.table as PgTable);
    const countQuery = whereClause ? countBase.where(whereClause) : countBase;

    const [rows, totalResult] = await Promise.all([
      paginatedDataQuery.execute(),
      countQuery.execute(),
    ]);

    return {
      data: rows as InferSelectModel<TTable>[],
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async findById(id: string): Promise<InferSelectModel<TTable> | null> {
    const conditions: SQL[] = [eq((this.table as any).id, id)];
    const sdCondition = this.buildSoftDeleteCondition();
    if (sdCondition) conditions.push(sdCondition);

    const result = await this.db
      .select()
      .from(this.table as PgTable)
      .where(and(...conditions))
      .limit(1);
    return (result[0] as InferSelectModel<TTable>) ?? null;
  }

  async findCount(where?: SQL): Promise<number> {
    const conditions: SQL[] = [];
    const sdCondition = this.buildSoftDeleteCondition();
    if (sdCondition) conditions.push(sdCondition);
    if (where) conditions.push(where);

    const result = await this.db
      .select({ count: count() })
      .from(this.table as PgTable)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  async create(
    data: Record<string, any>,
    tx?: Tx,
  ): Promise<InferSelectModel<TTable>> {
    const dbOrTx = tx ?? this.db;
    const results = await dbOrTx
      .insert(this.table)
      .values(data as any)
      .returning();

    return results[0] as InferSelectModel<TTable>;
  }

  async createMany(
    data: Record<string, any>[],
    tx?: Tx,
  ): Promise<InferSelectModel<TTable>[]> {
    if (!data || data.length === 0) {
      return [];
    }

    const dbOrTx = tx ?? this.db;
    const results = await dbOrTx
      .insert(this.table)
      .values(data as any)
      .returning();

    return results as InferSelectModel<TTable>[];
  }

  async update(
    id: string,
    data: Record<string, any>,
    idColumn: PgColumn = (this.table as any).id,
    tx?: Tx,
  ): Promise<InferSelectModel<TTable> | undefined> {
    const dbOrTx = tx ?? this.db;
    const results = await dbOrTx
      .update(this.table)
      .set(data as any)
      .where(and(eq(idColumn, id)))
      .returning();

    return results[0] as InferSelectModel<TTable> | undefined;
  }

  async updateWhere(
    conditions: SQL[] | SQL,
    data: Record<string, any>,
    tx?: Tx,
  ): Promise<InferSelectModel<TTable>[]> {
    const dbOrTx = tx ?? this.db;
    const whereClause = Array.isArray(conditions)
      ? and(...conditions)
      : conditions;
    const results = await dbOrTx
      .update(this.table)
      .set(data as any)
      .where(whereClause)
      .returning();

    return results as InferSelectModel<TTable>[];
  }

  async softDelete(id: string, tx?: Tx): Promise<boolean> {
    const sdCondition = this.buildSoftDeleteCondition();
    if (!sdCondition) {
      return false;
    }

    const dbOrTx = tx ?? this.db;
    const idColumn = (this.table as any).id as PgColumn;
    const rows = await dbOrTx
      .update(this.table)
      .set({ deletedAt: new Date() } as any)
      .where(and(eq(idColumn, id), sdCondition))
      .returning({ id: idColumn })
      .execute();

    return rows.length > 0;
  }

  async delete(
    id: string,
    idColumn: PgColumn = (this.table as any).id,
    tx?: Tx,
  ): Promise<InferSelectModel<TTable> | undefined> {
    const dbOrTx = tx ?? this.db;
    const sdCondition = this.buildSoftDeleteCondition();
    if (sdCondition) {
      const conditions: SQL[] = [eq(idColumn, id), sdCondition];
      const results = await dbOrTx
        .update(this.table)
        .set({ deletedAt: new Date() } as any)
        .where(and(...conditions))
        .returning();
      return results[0] as InferSelectModel<TTable> | undefined;
    }

    const results = await dbOrTx
      .delete(this.table)
      .where(and(eq(idColumn, id)))
      .returning();

    return results[0] as InferSelectModel<TTable> | undefined;
  }
}
