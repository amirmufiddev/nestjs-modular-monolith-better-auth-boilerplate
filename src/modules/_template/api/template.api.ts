import type { TemplateItemDto } from './dto/template.dto';

export const TEMPLATE_API = Symbol('TEMPLATE_API');

/** Public contract — modul lain inject `TEMPLATE_API`, bukan service/repository. */
export interface TemplateApi {
  listItems(): Promise<TemplateItemDto[]>;
}
