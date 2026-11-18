import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';

import { RegionalRepository } from './infrastructure/regional.repository';

import { RegionalService } from './application/regional.service';
import { RegionalController } from './presentation/regional.controller';
import { REGIONAL_API } from './api/regional.api';

import { RegionalFacade } from './facade/regional.facade';

/**
 * Nest module wiring for the regional master-data module.
 *
 * The regional module is a thin read-only lookup. The repository accesses the
 * shared `regional_addresses` table via the global `DRIZZLE` connection, and
 * the facade exposes the `REGIONAL_API` token for other modules to consume
 * without crossing module boundaries.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [RegionalController],
  providers: [
    RegionalRepository,
    RegionalService,
    RegionalFacade,
    { provide: REGIONAL_API, useClass: RegionalFacade },
  ],
  exports: [REGIONAL_API],
})
export class RegionalModule {}
