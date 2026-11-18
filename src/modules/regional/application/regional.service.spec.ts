import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { BusinessError } from '@/common/errors/business-error';
import { RegionalService } from './regional.service';
import { RegionalRepository } from '../infrastructure/regional.repository';
import type { RegionalDataDto } from '../api/dto/regional.dto';

describe('RegionalService', () => {
  const repo = {
    findByLevel: mock(
      (_level: 'province' | 'regency' | 'district' | 'village') =>
        Promise.resolve([] as RegionalDataDto[]),
    ),
    findChildren: mock(
      (
        _level: 'province' | 'regency' | 'district' | 'village',
        _parentCode: number,
      ) => Promise.resolve([] as RegionalDataDto[]),
    ),
  };

  let service: RegionalService;

  beforeEach(() => {
    repo.findByLevel.mockReset();
    repo.findChildren.mockReset();
    repo.findByLevel.mockResolvedValue([]);
    repo.findChildren.mockResolvedValue([]);
    service = new RegionalService(repo as unknown as RegionalRepository);
  });

  test('getProvinces returns list from repository filtered by level=province', async () => {
    const expected: RegionalDataDto[] = [
      {
        code: 31,
        name: 'DKI Jakarta',
        parentCode: null,
        postalCode: null,
      },
    ];
    repo.findByLevel.mockResolvedValueOnce(expected);

    const result = await service.getProvinces();

    expect(repo.findByLevel).toHaveBeenCalledWith('province');
    expect(result).toEqual(expected);
  });

  test('getRegencies throws BusinessError when parentCode is missing', async () => {
    await expect(async () => {
      await service.getRegencies(0 as unknown as number);
    }).toThrow(BusinessError);
    expect(repo.findChildren).not.toHaveBeenCalled();
  });

  test('getRegencies delegates to repository with level=regency and parentCode', async () => {
    const expected: RegionalDataDto[] = [
      {
        code: 3171,
        name: 'Kota Administrasi Jakarta Pusat',
        parentCode: 31,
        postalCode: null,
      },
    ];
    repo.findChildren.mockResolvedValueOnce(expected);

    const result = await service.getRegencies(31);

    expect(repo.findChildren).toHaveBeenCalledWith('regency', 31);
    expect(result).toEqual(expected);
  });

  test('getDistricts delegates to repository with level=district and parentCode', async () => {
    const expected: RegionalDataDto[] = [
      {
        code: 317101,
        name: 'Tanah Abang',
        parentCode: 3171,
        postalCode: '10110',
      },
    ];
    repo.findChildren.mockResolvedValueOnce(expected);

    const result = await service.getDistricts(3171);

    expect(repo.findChildren).toHaveBeenCalledWith('district', 3171);
    expect(result).toEqual(expected);
  });

  test('getVillages delegates to repository with level=village and parentCode', async () => {
    const expected: RegionalDataDto[] = [
      {
        code: 3171011001,
        name: 'Bendungan Hilir',
        parentCode: 317101,
        postalCode: '10210',
      },
    ];
    repo.findChildren.mockResolvedValueOnce(expected);

    const result = await service.getVillages(317101);

    expect(repo.findChildren).toHaveBeenCalledWith('village', 317101);
    expect(result).toEqual(expected);
  });

  test('returns empty array when repository has no rows', async () => {
    repo.findByLevel.mockResolvedValueOnce([]);
    repo.findChildren.mockResolvedValueOnce([]);

    expect(await service.getProvinces()).toEqual([]);
    expect(await service.getDistricts(9999)).toEqual([]);
  });
});
