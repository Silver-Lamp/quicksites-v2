/**
 * @jest-environment node
 */
// lib/prospects/__tests__/recentLocations.test.ts

import {
  addRecentLocation,
  normalizeRecentLocations,
  locationKey,
  locationLabel,
  relativeUsed,
  MAX_RECENT_LOCATIONS,
  type RecentLocation,
} from '@/lib/prospects/recentLocations';

const mk = (over: Partial<RecentLocation> & { city: string }): RecentLocation => ({
  city: over.city,
  region: over.region ?? 'MA',
  radiusKm: over.radiusKm ?? 3,
  categories: over.categories ?? ['Restaurants'],
  usedAt: over.usedAt ?? 1000,
});

describe('locationKey', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(locationKey('  Boston ', 'MA')).toBe(locationKey('boston', 'ma'));
  });
});

describe('locationLabel', () => {
  it('joins city + region, drops empty region', () => {
    expect(locationLabel({ city: 'Boston', region: 'MA' })).toBe('Boston, MA');
    expect(locationLabel({ city: 'Boston', region: '' })).toBe('Boston');
  });
});

describe('addRecentLocation', () => {
  it('adds to the front', () => {
    const out = addRecentLocation([mk({ city: 'A' })], mk({ city: 'B' }));
    expect(out.map((l) => l.city)).toEqual(['B', 'A']);
  });

  it('dedupes by city+region, moving the repeat to the front with new params', () => {
    const list = [mk({ city: 'A', radiusKm: 3 }), mk({ city: 'B' })];
    const out = addRecentLocation(list, mk({ city: 'a', radiusKm: 10 }));
    expect(out.map((l) => l.city)).toEqual(['a', 'B']);
    expect(out[0].radiusKm).toBe(10);
  });

  it('caps the list', () => {
    let list: RecentLocation[] = [];
    for (let i = 0; i < MAX_RECENT_LOCATIONS + 5; i++) list = addRecentLocation(list, mk({ city: `city${i}` }));
    expect(list).toHaveLength(MAX_RECENT_LOCATIONS);
    expect(list[0].city).toBe(`city${MAX_RECENT_LOCATIONS + 4}`);
  });
});

describe('normalizeRecentLocations', () => {
  it('drops junk, dedupes, sorts by usedAt desc, and defaults fields', () => {
    const out = normalizeRecentLocations([
      { city: 'A', usedAt: 100 },
      { city: 'B', region: 'NY', usedAt: 500, radiusKm: 7, categories: ['Plumbing'] },
      { city: 'a', usedAt: 999 }, // dup of A by key — first-seen wins
      { nope: true },
      42,
    ]);
    expect(out.map((l) => l.city)).toEqual(['B', 'A']);
    expect(out[0].radiusKm).toBe(7);
    expect(out[1].radiusKm).toBe(3); // default
    expect(out[1].categories).toEqual([]); // default
  });

  it('returns [] for non-arrays', () => {
    expect(normalizeRecentLocations(null)).toEqual([]);
    expect(normalizeRecentLocations('x')).toEqual([]);
  });
});

describe('relativeUsed', () => {
  const now = 1_000_000_000;
  it('formats buckets', () => {
    expect(relativeUsed(now, now)).toBe('just now');
    expect(relativeUsed(now - 5 * 60000, now)).toBe('5m ago');
    expect(relativeUsed(now - 3 * 3600_000, now)).toBe('3h ago');
    expect(relativeUsed(now - 2 * 86400_000, now)).toBe('2d ago');
    expect(relativeUsed(now - 60 * 86400_000, now)).toBe('2mo ago');
  });
});
