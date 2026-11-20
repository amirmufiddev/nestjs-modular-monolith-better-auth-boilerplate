import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, ilike, ne, or, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/database/database.constants';
import {
  member,
  user,
  pendingMemberLinks,
  type PendingMemberLink,
} from '@/database/schema';
import type { ListMembersOptions } from '../dto/member.dto';
import type {
  IMemberRepository,
  RawMemberRow,
} from '../interfaces/member-repository.interface';

@Injectable()
export class MemberRepository implements IMemberRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async listByOrganizationPaginated(
    organizationId: string,
    options?: ListMembersOptions,
  ): Promise<{ data: RawMemberRow[]; total: number }> {
    const conditions = [
      eq(member.organizationId, organizationId),
      // The owner role is intentionally hidden from the listing UI.
      // Use Better Auth's organization API if you need to manage owners.
      ne(member.role, 'owner'),
    ];

    if (options?.role && options.role !== 'owner') {
      conditions.push(eq(member.role, options.role));
    }

    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(ilike(user.name, searchPattern), ilike(user.email, searchPattern))!,
      );
    }

    const whereClause = and(...conditions);

    // Build a fresh select base using `$dynamic()` so we can conditionally
    // attach limit/offset via reassignment (matches the project's
    // BaseRepository pattern used by other modules).
    let dataQuery = this.db
      .select({
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        image: user.image,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(whereClause)
      .orderBy(desc(member.createdAt))
      .$dynamic();

    if (options?.limit !== undefined) {
      dataQuery = dataQuery.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      dataQuery = dataQuery.offset(options.offset);
    }

    const data = (await dataQuery.execute()) as RawMemberRow[];

    // Count total rows
    const countResult = await this.db
      .select({ total: count() })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(whereClause)
      .execute();

    const total = Number(countResult[0]?.total ?? 0);

    return { data, total };
  }

  async findById(
    organizationId: string,
    memberId: string,
  ): Promise<RawMemberRow | null> {
    const whereClause = and(
      eq(member.organizationId, organizationId),
      eq(member.id, memberId),
    );

    const rows = (await this.db
      .select({
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        image: user.image,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(whereClause)
      .limit(1)
      .execute()) as RawMemberRow[];

    return rows[0] ?? null;
  }

  async findByUserId(
    organizationId: string,
    userId: string,
  ): Promise<RawMemberRow | null> {
    const rows = (await this.db
      .select({
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
        image: user.image,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, userId),
        ),
      )
      .limit(1)
      .execute()) as RawMemberRow[];

    return rows[0] ?? null;
  }

  async upsertPendingLink(
    organizationId: string,
    email: string,
    role: string,
  ): Promise<PendingMemberLink> {
    const rows = await this.db
      .insert(pendingMemberLinks)
      .values({
        organizationId,
        email,
        role,
      })
      .onConflictDoUpdate({
        target: [pendingMemberLinks.organizationId, pendingMemberLinks.email],
        set: {
          role,
          updatedAt: new Date(),
        },
      })
      .returning()
      .execute();

    return rows[0];
  }

  async findPendingLink(
    organizationId: string,
    email: string,
  ): Promise<PendingMemberLink | null> {
    const rows = await this.db
      .select()
      .from(pendingMemberLinks)
      .where(
        and(
          eq(pendingMemberLinks.organizationId, organizationId),
          eq(pendingMemberLinks.email, email),
        ),
      )
      .limit(1)
      .execute();

    return rows[0] ?? null;
  }

  async deletePendingLink(
    organizationId: string,
    email: string,
  ): Promise<void> {
    await this.db
      .delete(pendingMemberLinks)
      .where(
        and(
          eq(pendingMemberLinks.organizationId, organizationId),
          eq(pendingMemberLinks.email, email),
        ),
      )
      .execute();
  }
}
