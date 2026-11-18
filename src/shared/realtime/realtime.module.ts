import { Global, Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeGateway } from './realtime.gateway';
@Global()
@Module({
  imports: [AuthModule],
  controllers: [SseController],
  providers: [SseService, RealtimePublisherService, RealtimeGateway],
  exports: [SseService, RealtimePublisherService],
})
export class RealtimeModule {}
