import { Injectable } from '@nestjs/common';
import type { TemplateItemDto } from '../api/dto/template.dto';
import { TemplateRepository } from '../infrastructure/template.repository';

/** Application layer — salin pola dari regional/application/regional.service.ts */
@Injectable()
export class TemplateService {
  constructor(private readonly repository: TemplateRepository) {}

  listItems(): Promise<TemplateItemDto[]> {
    return this.repository.findAll();
  }
}
