import { Inject, Injectable } from '@nestjs/common';
import { BusinessError } from '../../../common/errors/business-error';
import {
  TEMPLATE_REPOSITORY_TOKEN,
  type ITemplateRepository,
  type TemplateItem,
} from '../interfaces/template-repository.interface';
import { CreateTemplateDto } from '../dto/create-template.dto';

@Injectable()
export class TemplateService {
  constructor(
    @Inject(TEMPLATE_REPOSITORY_TOKEN)
    private readonly templateRepo: ITemplateRepository,
  ) {}

  async getById(id: string): Promise<TemplateItem> {
    const item = await this.templateRepo.findById(id);
    if (!item) {
      throw BusinessError.notFound('Template', id);
    }
    return item;
  }

  async create(
    dto: CreateTemplateDto,
    organizationId: string,
  ): Promise<TemplateItem> {
    const existing = await this.templateRepo.findByName(
      dto.name,
      organizationId,
    );
    if (existing) {
      throw BusinessError.conflict(
        'Template name already exists',
        'TEMPLATE_NAME_CONFLICT',
        {
          name: dto.name,
        },
      );
    }
    return this.templateRepo.create({ name: dto.name, organizationId });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.templateRepo.delete(id);
  }
}
