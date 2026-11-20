import { beforeEach, describe, expect, mock, it } from 'bun:test';
import { TemplateController } from './template.controller';
import { TemplateService } from '../services/template.service';
import type { TemplateItem } from '../interfaces/template-repository.interface';

describe('TemplateController', () => {
  let controller: TemplateController;
  let service: TemplateService;

  const sampleItem: TemplateItem = {
    id: 'tpl_100',
    name: 'Sample Template',
    organizationId: 'default_org',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    service = {
      getById: mock((_id: string) => Promise.resolve(sampleItem)),
      create: mock((dto: { name: string }, orgId: string) =>
        Promise.resolve({
          ...sampleItem,
          name: dto.name,
          organizationId: orgId,
        }),
      ),
      delete: mock((_id: string) => Promise.resolve()),
    } as unknown as TemplateService;

    controller = new TemplateController(service);
  });

  it('should find one template by id', async () => {
    const result = await controller.findOne('tpl_100');

    expect(service.getById).toHaveBeenCalledWith('tpl_100');
    expect(result).toEqual(sampleItem);
  });

  it('should create template with default organization', async () => {
    const dto = { name: 'New Blueprint' };
    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto, 'default_org');
    expect(result.name).toBe('New Blueprint');
  });

  it('should delete template by id', async () => {
    await controller.delete('tpl_100');

    expect(service.delete).toHaveBeenCalledWith('tpl_100');
  });
});
