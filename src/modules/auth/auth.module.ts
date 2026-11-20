import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createAuthInstance } from './auth';
import { DatabaseModule } from '@/database/database.module';
import { DRIZZLE } from '@/database/database.constants';
import * as schema from '@/database/schema';
import { loadBetterAuthStatement } from '@/modules/rbac/permissions/rbac-permission.loader';
import { EmailModule, EmailService } from '@/modules/email';
import { AppLoggerService } from '@/logger/logger.service';
import {
  BetterAuthCacheModule,
  BETTER_AUTH_SECONDARY_STORAGE,
} from '@/common/auth/better-auth-cache.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    BetterAuthCacheModule,
    BetterAuthModule.forRootAsync({
      imports: [EmailModule, DatabaseModule],
      inject: [
        ConfigService,
        EmailService,
        AppLoggerService,
        EventEmitter2,
        BETTER_AUTH_SECONDARY_STORAGE,
        DRIZZLE,
      ],
      useFactory: async (
        configService: ConfigService,
        emailService: EmailService,
        loggerService: AppLoggerService,
        eventEmitter: EventEmitter2,
        secondaryStorage: unknown,
        db: NodePgDatabase<typeof schema>,
      ) => {
        const betterAuthStatement = await loadBetterAuthStatement(db);
        return {
          auth: createAuthInstance({
            configService,
            emailService,
            loggerService,
            eventEmitter,
            secondaryStorage: secondaryStorage as Parameters<
              typeof createAuthInstance
            >[0]['secondaryStorage'],
            betterAuthStatement,
          }),
          isGlobal: true,
          disableGlobalAuthGuard: false,
        };
      },
    }),
  ],
  exports: [BetterAuthModule],
})
export class AuthModule {}
