import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { RegionalController } from './regional.controller';

describe('RegionalController', () => {
  let controller: RegionalController;
  let service: any;

  beforeEach(() => {
    service = {
      getProvinces: mock(() =>
        Promise.resolve([
          { code: 31, name: 'DKI JAKARTA', parentCode: null, postalCode: null },
        ]),
      ),
      getRegencies: mock(() =>
        Promise.resolve([
          {
            code: 3171,
            name: 'KOTA ADM. JAKARTA SELATAN',
            parentCode: 31,
            postalCode: null,
          },
        ]),
      ),
      getDistricts: mock(() =>
        Promise.resolve([
          {
            code: 317101,
            name: 'TEBET',
            parentCode: 3171,
            postalCode: null,
          },
        ]),
      ),
      getVillages: mock(() =>
        Promise.resolve([
          {
            code: 3171011001,
            name: 'TEBET BARAT',
            parentCode: 317101,
            postalCode: '12810',
          },
        ]),
      ),
    };

    controller = new RegionalController(service);
  });

  test('getProvinces returns mapped list of provinces', async () => {
    const result = await controller.getProvinces();
    expect(service.getProvinces).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe(31);
  });

  test('getRegencies returns regencies when parentCode provided', async () => {
    const result = await controller.getRegencies('31');
    expect(service.getRegencies).toHaveBeenCalledWith(31);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe(3171);
  });

  test('getRegencies throws when parentCode is missing', async () => {
    await expect(controller.getRegencies(undefined as any)).rejects.toThrow();
  });
});
