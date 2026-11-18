import { parseCoordinate } from './coordinate.util';

describe('parseCoordinate', () => {
  it('should return null for null input', () => {
    expect(parseCoordinate(null)).toBeNull();
  });

  it('should parse valid numeric strings', () => {
    expect(parseCoordinate('-6.2088')).toBe(-6.2088);
    expect(parseCoordinate('106.8456')).toBe(106.8456);
    expect(parseCoordinate('0')).toBe(0);
  });

  it('should return null for non-finite values', () => {
    expect(parseCoordinate('not-a-number')).toBeNull();
    expect(parseCoordinate('Infinity')).toBeNull();
    expect(parseCoordinate('-Infinity')).toBeNull();
    expect(parseCoordinate('NaN')).toBeNull();
  });
});
