import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { TEMPLATE_API } from './api/template.api';
import { TemplateService } from './application/template.service';
import { TemplateFacade } from './facade/template.facade';
import { TemplateRepository } from './infrastructure/template.repository';
import { TemplateController } from './presentation/template.controller';

/**
 * Scaffold module — **do not** import in `AppModule` until copied & renamed.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [TemplateController],
  providers: [
    TemplateRepository,
    TemplateService,
    TemplateFacade,
    { provide: TEMPLATE_API, useClass: TemplateFacade },
  ],
  exports: [TEMPLATE_API],
})
export class TemplateModule {}
