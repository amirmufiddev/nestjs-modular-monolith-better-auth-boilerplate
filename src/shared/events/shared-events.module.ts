import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppLoggerService } from '@/logger/logger.service';
import { LoggerModule } from '@/logger/logger.module';

@Global()
@Module({
  imports: [
    LoggerModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 50,
    }),
  ],
})
export class SharedEventsModule {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.log(
      'SharedEventsModule initialized with wildcard EventEmitter',
      { context: 'SharedEventsModule' },
    );
  }
}
