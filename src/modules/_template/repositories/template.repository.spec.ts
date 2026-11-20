import { beforeEach, describe, expect, it } from 'bun:test';
import { TemplateRepository } from './template.repository';

describe('TemplateRepository', () => {
  let repository: TemplateRepository;

  beforeEach(() => {
    repository = new TemplateRepository();
  });

  it('should create an item and return it', async () => {
    const item = await repository.create({
      name: 'Alpha',
      organizationId: 'org_1',
    });

    expect(item).toBeDefined();
    expect(item.id).toMatch(/^tpl_/);
    expect(item.name).toBe('Alpha');
    expect(item.organizationId).toBe('org_1');
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.updatedAt).toBeInstanceOf(Date);
  });

  it('should find an item by id', async () => {
    const created = await repository.create({
      name: 'Alpha',
      organizationId: 'org_1',
    });
    const found = await repository.findById(created.id);

    expect(found).toEqual(created);
  });

  it('should return null when item not found by id', async () => {
    const found = await repository.findById('unknown_id');
    expect(found).toBeNull();
  });

  it('should find an item by name and organizationId', async () => {
    const created = await repository.create({
      name: 'Alpha',
      organizationId: 'org_1',
    });
    const found = await repository.findByName('Alpha', 'org_1');

    expect(found).toEqual(created);
  });

  it('should return null when name does not match organization', async () => {
    await repository.create({ name: 'Alpha', organizationId: 'org_1' });
    const found = await repository.findByName('Alpha', 'other_org');

    expect(found).toBeNull();
  });

  it('should delete an item by id', async () => {
    const created = await repository.create({
      name: 'Alpha',
      organizationId: 'org_1',
    });
    await repository.delete(created.id);

    const found = await repository.findById(created.id);
    expect(found).toBeNull();
  });
});
