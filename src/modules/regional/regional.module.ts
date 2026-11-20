import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { RegionalController } from './controllers/regional.controller';
import { RegionalService } from './services/regional.service';
import { RegionalRepository } from './repositories/regional.repository';
import { REGIONAL_REPOSITORY_TOKEN } from './interfaces/regional-repository.interface';

/**
 * Nest module wiring for the regional master-data module.
 *
 * The regional module is a thin read-only lookup. The repository accesses the
 * shared `regional_addresses` table via the global `DRIZZLE` connection.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [RegionalController],
  providers: [
    RegionalService,
    {
      provide: REGIONAL_REPOSITORY_TOKEN,
      useClass: RegionalRepository,
    },
  ],
  exports: [RegionalService, REGIONAL_REPOSITORY_TOKEN],
})
export class RegionalModule {}
