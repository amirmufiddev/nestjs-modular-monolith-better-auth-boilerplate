import { Injectable } from '@nestjs/common';
import type {
  ITemplateRepository,
  TemplateItem,
} from '../interfaces/template-repository.interface';

@Injectable()
export class TemplateRepository implements ITemplateRepository {
  private items: Map<string, TemplateItem> = new Map();

  findById(id: string): Promise<TemplateItem | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }

  findByName(
    name: string,
    organizationId: string,
  ): Promise<TemplateItem | null> {
    for (const item of this.items.values()) {
      if (item.name === name && item.organizationId === organizationId) {
        return Promise.resolve(item);
      }
    }
    return Promise.resolve(null);
  }

  create(data: {
    name: string;
    organizationId: string;
  }): Promise<TemplateItem> {
    const item: TemplateItem = {
      id: `tpl_${Date.now()}`,
      name: data.name,
      organizationId: data.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.set(item.id, item);
    return Promise.resolve(item);
  }

  delete(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }
}
