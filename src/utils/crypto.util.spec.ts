import { cryptoRandomId } from './crypto.util';

describe('cryptoRandomId', () => {
  it('should return a non-empty string', () => {
    const id = cryptoRandomId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should return valid UUID v4 formatted strings', () => {
    const id = cryptoRandomId();
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Regex);
  });

  it('should generate 1000 unique IDs without collision', () => {
    const total = 1000;
    const ids = new Set<string>();

    for (let i = 0; i < total; i++) {
      ids.add(cryptoRandomId());
    }

    expect(ids.size).toBe(total);
  });

  it('should not use Math.random', () => {
    const mathRandomSpy = jest.spyOn(Math, 'random');
    cryptoRandomId();
    expect(mathRandomSpy).not.toHaveBeenCalled();
    mathRandomSpy.mockRestore();
  });
});
