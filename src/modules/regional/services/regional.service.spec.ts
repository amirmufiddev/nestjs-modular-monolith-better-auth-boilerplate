import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { Test } from '@nestjs/testing';
import { BusinessError } from '@/common/errors/business-error';
import { RegionalService } from './regional.service';
import {
  REGIONAL_REPOSITORY_TOKEN,
  type IRegionalRepository,
} from '../interfaces/regional-repository.interface';
import type { RegionalDataDto } from '../dto/regional.dto';

describe('RegionalService', () => {
  const repo: IRegionalRepository = {
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

  beforeEach(async () => {
    (repo.findByLevel as any).mockReset();
    (repo.findChildren as any).mockReset();
    (repo.findByLevel as any).mockResolvedValue([]);
    (repo.findChildren as any).mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        RegionalService,
        {
          provide: REGIONAL_REPOSITORY_TOKEN,
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<RegionalService>(RegionalService);
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
    (repo.findByLevel as any).mockResolvedValueOnce(expected);

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
    (repo.findChildren as any).mockResolvedValueOnce(expected);

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
    (repo.findChildren as any).mockResolvedValueOnce(expected);

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
    (repo.findChildren as any).mockResolvedValueOnce(expected);

    const result = await service.getVillages(317101);

    expect(repo.findChildren).toHaveBeenCalledWith('village', 317101);
    expect(result).toEqual(expected);
  });

  test('returns empty array when repository has no rows', async () => {
    (repo.findByLevel as any).mockResolvedValueOnce([]);
    (repo.findChildren as any).mockResolvedValueOnce([]);

    expect(await service.getProvinces()).toEqual([]);
    expect(await service.getDistricts(9999)).toEqual([]);
  });
});
