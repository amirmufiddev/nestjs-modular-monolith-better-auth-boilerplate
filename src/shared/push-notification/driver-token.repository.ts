import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@/database/database.constants';
import {
  pushTokens,
  type PushToken,
} from '@/shared/push-notification/schema/push-tokens.schema';

export type PushPlatform = 'ios' | 'android' | 'web';

export interface DriverToken {
  userId: string;
  fcmToken: string;
  devicePlatform: PushPlatform;
  lastSeenAt: Date;
}

@Injectable()
export class DriverTokenRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  async save(token: DriverToken): Promise<void> {
    await this.db
      .insert(pushTokens)
      .values({
        userId: token.userId,
        fcmToken: token.fcmToken,
        platform: token.devicePlatform,
        lastSeenAt: token.lastSeenAt,
        deletedAt: null,
      })
      .onConflictDoUpdate({
        target: pushTokens.fcmToken,
        set: {
          userId: token.userId,
          platform: token.devicePlatform,
          lastSeenAt: token.lastSeenAt,
          updatedAt: new Date(),
          deletedAt: null,
        },
      });
  }

  async findByUserId(userId: string): Promise<DriverToken[]> {
    const rows = await this.db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), isNull(pushTokens.deletedAt)))
      .execute();
    return rows.map((row) => this.toToken(row));
  }

  async findByToken(fcmToken: string): Promise<DriverToken | null> {
    const rows = await this.db
      .select()
      .from(pushTokens)
      .where(
        and(eq(pushTokens.fcmToken, fcmToken), isNull(pushTokens.deletedAt)),
      )
      .limit(1)
      .execute();
    return rows[0] ? this.toToken(rows[0]) : null;
  }

  async delete(fcmToken: string): Promise<void> {
    await this.db
      .update(pushTokens)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(pushTokens.fcmToken, fcmToken));
  }

  async deleteForUser(userId: string, fcmToken: string): Promise<void> {
    await this.db
      .update(pushTokens)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(pushTokens.fcmToken, fcmToken),
          eq(pushTokens.userId, userId),
          isNull(pushTokens.deletedAt),
        ),
      );
  }

  async findAllActive(): Promise<DriverToken[]> {
    const rows = await this.db
      .select()
      .from(pushTokens)
      .where(isNull(pushTokens.deletedAt))
      .execute();
    return rows.map((row) => this.toToken(row));
  }

  private toToken(row: PushToken): DriverToken {
    return {
      userId: row.userId,
      fcmToken: row.fcmToken,
      devicePlatform: row.platform as PushPlatform,
      lastSeenAt: row.lastSeenAt,
    };
  }
}
