export const TEMPLATE_REPOSITORY_TOKEN = Symbol('TEMPLATE_REPOSITORY_TOKEN');

export interface TemplateItem {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemplateRepository {
  findById(id: string): Promise<TemplateItem | null>;
  findByName(
    name: string,
    organizationId: string,
  ): Promise<TemplateItem | null>;
  create(data: { name: string; organizationId: string }): Promise<TemplateItem>;
  delete(id: string): Promise<void>;
}
