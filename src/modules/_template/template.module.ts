import { Module } from '@nestjs/common';
import { TemplateController } from './controllers/template.controller';
import { TemplateService } from './services/template.service';
import { TemplateRepository } from './repositories/template.repository';
import { TEMPLATE_REPOSITORY_TOKEN } from './interfaces/template-repository.interface';

@Module({
  controllers: [TemplateController],
  providers: [
    TemplateService,
    {
      provide: TEMPLATE_REPOSITORY_TOKEN,
      useClass: TemplateRepository,
    },
  ],
  exports: [TemplateService, TEMPLATE_REPOSITORY_TOKEN],
})
export class TemplateModule {}
