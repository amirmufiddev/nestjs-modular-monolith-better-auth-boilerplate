import { beforeEach, describe, expect, mock, it } from 'bun:test';
import { BusinessError } from '../../../common/errors/business-error';
import { TemplateService } from './template.service';
import type {
  ITemplateRepository,
  TemplateItem,
} from '../interfaces/template-repository.interface';

describe('TemplateService', () => {
  let service: TemplateService;
  let mockRepo: ITemplateRepository;

  const sampleItem: TemplateItem = {
    id: 'tpl_1',
    name: 'Sample Template',
    organizationId: 'org_1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockRepo = {
      findById: mock((_id: string) =>
        Promise.resolve<TemplateItem | null>(null),
      ),
      findByName: mock((_name: string, _orgId: string) =>
        Promise.resolve<TemplateItem | null>(null),
      ),
      create: mock((data: { name: string; organizationId: string }) =>
        Promise.resolve<TemplateItem>({
          id: 'tpl_2',
          name: data.name,
          organizationId: data.organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      delete: mock((_id: string) => Promise.resolve()),
    };
    service = new TemplateService(mockRepo);
  });

  describe('getById', () => {
    it('should return item when found', async () => {
      mockRepo.findById = mock(() => Promise.resolve(sampleItem));
      const result = await service.getById('tpl_1');
      expect(result).toEqual(sampleItem);
      expect(mockRepo.findById).toHaveBeenCalledWith('tpl_1');
    });

    it('should throw BusinessError notFound when item does not exist', async () => {
      mockRepo.findById = mock(() => Promise.resolve(null));
      await expect(service.getById('non_existent')).rejects.toThrow(
        BusinessError,
      );
    });
  });

  describe('create', () => {
    it('should create and return template when name is unique in organization', async () => {
      mockRepo.findByName = mock(() => Promise.resolve(null));
      const dto = { name: 'New Template' };

      const result = await service.create(dto, 'org_1');

      expect(result.name).toBe('New Template');
      expect(result.organizationId).toBe('org_1');
      expect(mockRepo.create).toHaveBeenCalledWith({
        name: 'New Template',
        organizationId: 'org_1',
      });
    });

    it('should throw BusinessError conflict when name already exists in organization', async () => {
      mockRepo.findByName = mock(() => Promise.resolve(sampleItem));
      const dto = { name: 'Sample Template' };

      await expect(service.create(dto, 'org_1')).rejects.toThrow(BusinessError);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete template when item exists', async () => {
      mockRepo.findById = mock(() => Promise.resolve(sampleItem));

      await service.delete('tpl_1');

      expect(mockRepo.delete).toHaveBeenCalledWith('tpl_1');
    });

    it('should throw BusinessError when deleting non-existent template', async () => {
      mockRepo.findById = mock(() => Promise.resolve(null));

      await expect(service.delete('tpl_missing')).rejects.toThrow(
        BusinessError,
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
