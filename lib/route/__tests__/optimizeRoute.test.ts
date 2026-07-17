/**
 * @jest-environment node
 */
// lib/route/__tests__/optimizeRoute.test.ts
//
// Pins the borrowed PorchHearth routing seam: Haversine distance + greedy nearest-neighbor
// order + straight-line total. Generic passthrough of non-coord fields is load-bearing
// (the block reorders whole stop objects).

import { calculateDistance, optimizeRoute, totalStraightLineMiles } from '@/lib/route/optimizeRoute';

describe('calculateDistance', () => {
  it('is ~0 for identical points and symmetric', () => {
    expect(calculateDistance(47.6, -122.3, 47.6, -122.3)).toBeCloseTo(0, 5);
    const ab = calculateDistance(47.6, -122.3, 47.7, -122.2);
    const ba = calculateDistance(47.7, -122.2, 47.6, -122.3);
    expect(ab).toBeCloseTo(ba, 9);
    expect(ab).toBeGreaterThan(0);
  });
});

describe('optimizeRoute', () => {
  it('orders stops nearest-first from the start and passes fields through', () => {
    const stops = [
      { id: 'far', latitude: 47.9, longitude: -122.0 },
      { id: 'near', latitude: 47.61, longitude: -122.29 },
      { id: 'mid', latitude: 47.7, longitude: -122.2 },
    ];
    const ordered = optimizeRoute(47.6, -122.3, stops);
    expect(ordered.map((s) => s.id)).toEqual(['near', 'mid', 'far']);
    // whole objects returned untouched
    expect(ordered[0]).toEqual({ id: 'near', latitude: 47.61, longitude: -122.29 });
  });
  it('returns [] for no stops', () => {
    expect(optimizeRoute(0, 0, [])).toEqual([]);
  });
});

describe('totalStraightLineMiles', () => {
  it('sums the legs along the ordered path', () => {
    const start = { lat: 47.6, lon: -122.3 };
    const ordered = [
      { latitude: 47.61, longitude: -122.29 },
      { latitude: 47.7, longitude: -122.2 },
    ];
    const legA = calculateDistance(start.lat, start.lon, 47.61, -122.29);
    const legB = calculateDistance(47.61, -122.29, 47.7, -122.2);
    expect(totalStraightLineMiles(start.lat, start.lon, ordered)).toBeCloseTo(legA + legB, 9);
  });
});
