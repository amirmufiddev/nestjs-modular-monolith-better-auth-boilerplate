import { Injectable } from '@nestjs/common';
import type { TemplateItemDto } from '../api/dto/template.dto';

/**
 * Infrastructure — salin dari regional/infrastructure/regional.repository.ts.
 * Inject DRIZZLE / schema di implementasi nyata.
 */
@Injectable()
export class TemplateRepository {
  findAll(): Promise<TemplateItemDto[]> {
    return Promise.resolve([]);
  }
}
