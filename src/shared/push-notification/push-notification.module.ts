import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { FcmAdapter } from './fcm.adapter';
import { DriverTokenRepository } from './driver-token.repository';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [FcmAdapter, DriverTokenRepository],
  exports: [FcmAdapter, DriverTokenRepository],
})
export class PushNotificationModule {}
