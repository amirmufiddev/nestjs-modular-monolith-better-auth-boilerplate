import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { RegionalRepository } from './regional.repository';

function makeSelectChain<T>(rows: T[] = []) {
  const chain: any = {
    from: mock(() => chain),
    where: mock(() => chain),
    orderBy: mock(() => chain),
    execute: mock(() => Promise.resolve(rows)),
  };
  return chain;
}

describe('RegionalRepository', () => {
  let repo: RegionalRepository;
  let db: any;

  beforeEach(() => {
    db = { select: mock() };
    repo = new RegionalRepository(db);
  });

  test('findByLevel returns mapped RegionalDataDto list for province', async () => {
    const rows = [
      { code: 31, name: 'DKI JAKARTA', parentCode: null, postalCode: null },
      { code: 32, name: 'JAWA BARAT', parentCode: null, postalCode: null },
    ];
    const chain = makeSelectChain(rows);
    db.select.mockReturnValue(chain);

    const result = await repo.findByLevel('province');

    expect(db.select).toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalled();
    expect(chain.orderBy).toHaveBeenCalled();
    expect(result).toEqual([
      { code: 31, name: 'DKI JAKARTA', parentCode: null, postalCode: null },
      { code: 32, name: 'JAWA BARAT', parentCode: null, postalCode: null },
    ]);
  });

  test('findByLevel returns mapped RegionalDataDto list for non-province level', async () => {
    const rows = [
      {
        code: 3171,
        name: 'KOTA ADM. JAKARTA SELATAN',
        parentCode: 31,
        postalCode: null,
      },
    ];
    const chain = makeSelectChain(rows);
    db.select.mockReturnValue(chain);

    const result = await repo.findByLevel('regency');

    expect(result).toEqual([
      {
        code: 3171,
        name: 'KOTA ADM. JAKARTA SELATAN',
        parentCode: 31,
        postalCode: null,
      },
    ]);
  });

  test('findChildren returns children by parentCode', async () => {
    const rows = [
      { code: 317101, name: 'TEBET', parentCode: 3171, postalCode: null },
      { code: 317102, name: 'SETIABUDI', parentCode: 3171, postalCode: null },
    ];
    const chain = makeSelectChain(rows);
    db.select.mockReturnValue(chain);

    const result = await repo.findChildren('district', 3171);

    expect(chain.where).toHaveBeenCalled();
    expect(result).toEqual([
      { code: 317101, name: 'TEBET', parentCode: 3171, postalCode: null },
      { code: 317102, name: 'SETIABUDI', parentCode: 3171, postalCode: null },
    ]);
  });
});
