import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/database/database.constants';
import { regionalAddresses } from '@/database/schema/regional';
import type { RegionalDataDto } from '../api/dto/regional.dto';

type RegionalLevel = 'province' | 'regency' | 'district' | 'village';

/**
 * Repository for the `regional_addresses` shared master-data table.
 *
 * Reads only — the regional module is a read-only master-data lookup, so there
 * are no insert/update/delete operations. Writes (seed/admin imports) happen
 * via the standalone `regional.seed.ts` script.
 */
@Injectable()
export class RegionalRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async findByLevel(level: RegionalLevel): Promise<RegionalDataDto[]> {
    const where =
      level === 'province'
        ? and(
            eq(regionalAddresses.level, level),
            isNull(regionalAddresses.parentCode),
          )
        : eq(regionalAddresses.level, level);

    const rows = await this.db
      .select({
        code: regionalAddresses.code,
        name: regionalAddresses.name,
        parentCode: regionalAddresses.parentCode,
        postalCode: regionalAddresses.postalCode,
      })
      .from(regionalAddresses)
      .where(where)
      .orderBy(asc(regionalAddresses.code))
      .execute();
    return rows.map((row) => this.toDto(row));
  }

  async findChildren(
    level: RegionalLevel,
    parentCode: number,
  ): Promise<RegionalDataDto[]> {
    const rows = await this.db
      .select({
        code: regionalAddresses.code,
        name: regionalAddresses.name,
        parentCode: regionalAddresses.parentCode,
        postalCode: regionalAddresses.postalCode,
      })
      .from(regionalAddresses)
      .where(
        and(
          eq(regionalAddresses.level, level),
          eq(regionalAddresses.parentCode, parentCode),
        ),
      )
      .orderBy(asc(regionalAddresses.code))
      .execute();
    return rows.map((row) => this.toDto(row));
  }

  private toDto(row: {
    code: number;
    name: string;
    parentCode: number | null;
    postalCode: string | null;
  }): RegionalDataDto {
    return {
      code: row.code,
      name: row.name,
      parentCode: row.parentCode,
      postalCode: row.postalCode,
    };
  }
}
