import { describe, expect, test } from 'bun:test';
import { haversineKm, type Coord } from './geo.util';

describe('haversineKm', () => {
  test('returns 0 when both coordinates are identical', () => {
    const point: Coord = { lat: -6.2088, lng: 106.8456 };
    expect(haversineKm(point, point)).toBe(0);
  });

  test('calculates correct distance between Jakarta and Bandung (~120 km)', () => {
    const jakarta: Coord = { lat: -6.2088, lng: 106.8456 };
    const bandung: Coord = { lat: -6.9175, lng: 107.6191 };

    const distance = haversineKm(jakarta, bandung);

    // Expected distance between Jakarta and Bandung is around 115-125 km
    expect(distance).toBeGreaterThan(115);
    expect(distance).toBeLessThan(125);
  });

  test('takes longitude difference into account when latitudes are identical', () => {
    const pointA: Coord = { lat: -6.2088, lng: 106.8456 };
    const pointB: Coord = { lat: -6.2088, lng: 107.8456 };

    const distance = haversineKm(pointA, pointB);

    expect(distance).toBeGreaterThan(0);
    // 1 degree of longitude at ~6 degrees S is approx 110.6 km
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });
});
