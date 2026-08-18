// lib/yardSale/__tests__/cities.test.ts
import { YARD_SALE_CITIES, findCity, neighborsOf, cityLabel } from '@/lib/yardSale/cities';

describe('the city list stays small and coherent', () => {
  // ⚠️ The guard against the failure mode, not a style rule. Fanning this across the ~55 seeded
  // cities turns near-identical pages into a doorway-page penalty on the whole domain. Raising
  // this cap should be a deliberate act with content to justify it.
  it('is at most 8 cities', () => {
    expect(YARD_SALE_CITIES.length).toBeLessThanOrEqual(8);
    expect(YARD_SALE_CITIES.length).toBeGreaterThan(0);
  });

  it('has unique slugs', () => {
    const slugs = YARD_SALE_CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('slugs are url-safe and region-suffixed', () => {
    for (const c of YARD_SALE_CITIES) expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{2}$/);
  });

  // Cross-links are only honest if they are mutual — "near Burien" on the Tukwila page has to
  // mean Tukwila is also near Burien, or one of the two pages is making it up.
  it('neighbour relationships are mutual and resolve', () => {
    for (const c of YARD_SALE_CITIES) {
      for (const n of neighborsOf(c)) {
        expect(n.neighbors).toContain(c.slug);
      }
      expect(neighborsOf(c).length).toBe(c.neighbors.length);
    }
  });

  it('no city is stranded without neighbours', () => {
    for (const c of YARD_SALE_CITIES) expect(c.neighbors.length).toBeGreaterThan(0);
  });
});

describe('lookup', () => {
  it('finds by slug, case-insensitively', () => {
    expect(findCity('renton-wa')?.city).toBe('Renton');
    expect(findCity('RENTON-WA')?.city).toBe('Renton');
  });
  it('returns null for an unknown slug rather than guessing', () => {
    expect(findCity('atlantis-wa')).toBeNull();
    expect(findCity('')).toBeNull();
  });
  it('labels consistently', () => {
    expect(cityLabel(findCity('seatac-wa')!)).toBe('SeaTac, WA');
  });
});
