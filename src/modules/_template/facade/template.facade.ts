import { Injectable } from '@nestjs/common';
import type { TemplateApi } from '../api/template.api';
import type { TemplateItemDto } from '../api/dto/template.dto';
import { TemplateService } from '../application/template.service';

@Injectable()
export class TemplateFacade implements TemplateApi {
  constructor(private readonly service: TemplateService) {}

  listItems(): Promise<TemplateItemDto[]> {
    return this.service.listItems();
  }
}
