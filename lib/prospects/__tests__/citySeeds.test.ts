/**
 * @jest-environment node
 */
// lib/prospects/__tests__/citySeeds.test.ts

import {
  citiesForMetro,
  normalizeMetroKey,
  availableMetros,
  citiesFromProspects,
} from '@/lib/prospects/citySeeds';

describe('citySeeds — metro lookup', () => {
  it('normalizes metro names case/space/punctuation-insensitively', () => {
    expect(normalizeMetroKey('  Seattle ')).toBe('seattle');
    expect(normalizeMetroKey('Greater-Boston')).toBe('greaterboston');
  });

  it('returns curated cities for a known metro', () => {
    const cities = citiesForMetro('seattle');
    expect(cities.length).toBeGreaterThan(20);
    expect(cities.some((c) => c.city === 'Renton' && c.region === 'WA')).toBe(true);
  });

  it('returns [] for an unknown metro', () => {
    expect(citiesForMetro('atlantis')).toEqual([]);
  });

  it('has no duplicate (city,region) pairs within a metro', () => {
    for (const metro of availableMetros()) {
      const cities = citiesForMetro(metro);
      const keys = cities.map((c) => `${c.city.toLowerCase()}::${c.region.toLowerCase()}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('citiesFromProspects — harvest swept cities', () => {
  it('dedupes (city,region) case-insensitively, first casing wins, sorted', () => {
    const out = citiesFromProspects([
      { city: 'Quincy', region: 'MA' },
      { city: 'quincy', region: 'ma' },
      { city: 'Boston', region: 'MA' },
      { city: '  ', region: 'MA' },
      { city: null, region: 'MA' },
    ]);
    expect(out).toEqual([
      { city: 'Boston', region: 'MA' },
      { city: 'Quincy', region: 'MA' },
    ]);
  });

  it('treats same city in different regions as distinct', () => {
    const out = citiesFromProspects([
      { city: 'Everett', region: 'WA' },
      { city: 'Everett', region: 'MA' },
    ]);
    expect(out).toHaveLength(2);
  });
});
