/**
 * @jest-environment node
 */
// lib/prospects/__tests__/territoryScore.test.ts

import { scoreTerritories, type ScorableProspect } from '@/lib/prospects/territoryScore';

// A prospect at a given cell anchor. Anchors are >0.02° apart so they land in distinct
// grid cells; jitter stays well within one cell.
function mk(over: Partial<ScorableProspect> & { lat: number; lon: number }): ScorableProspect {
  return {
    address_lat: over.lat,
    address_lon: over.lon,
    city: over.city ?? 'Testville',
    region: over.region ?? 'MA',
    industry_key: over.industry_key ?? 'towing',
    lead_tier: over.lead_tier ?? 'no_website',
    review_count: over.review_count ?? null,
    rating: over.rating ?? null,
  };
}

const A = { lat: 42.30, lon: -71.10 }; // cell A
const B = { lat: 42.50, lon: -71.40 }; // cell B (far from A)

describe('scoreTerritories', () => {
  it('ranks a premium-industry card above a low-industry card at equal density', () => {
    const prospects = [
      // Cell A: 2 no-website towing (PREMIUM rent tier) → one viable card
      mk({ ...A, industry_key: 'towing' }),
      mk({ ...A, lat: A.lat + 0.003, industry_key: 'towing' }),
      // Cell B: 2 no-website of an unknown/low-tier industry → one viable card
      mk({ ...B, industry_key: 'some_unknown_trade' }),
      mk({ ...B, lat: B.lat + 0.003, industry_key: 'some_unknown_trade' }),
    ];
    const scored = scoreTerritories(prospects);
    expect(scored).toHaveLength(2);
    // Towing cell wins purely on unlockable rent (same no-website count on both).
    expect(scored[0].rationale.topIndustry).toBe('towing');
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
    expect(scored[0].estMonthlyRentCents).toBeGreaterThan(scored[1].estMonthlyRentCents);
  });

  it('counts a >=2 no-website cluster as one viable competition card, priced per industry', () => {
    const scored = scoreTerritories([
      mk({ ...A, industry_key: 'towing' }),
      mk({ ...A, lat: A.lat + 0.002, industry_key: 'towing' }),
    ]);
    expect(scored[0].viableCards).toBe(1); // 2 shops competing for ONE geo-domain = 1 card
    expect(scored[0].estMonthlyRentCents).toBe(39900); // priceTier('towing').fullCents (premium)
  });

  it('does not count a lone no-website business as a card', () => {
    const scored = scoreTerritories([mk({ ...A, industry_key: 'towing' })]);
    expect(scored[0].viableCards).toBe(0);
    expect(scored[0].estMonthlyRentCents).toBe(0);
  });

  it('penalizes a saturated cell (lots of existing sites) vs a clean one at equal opportunity', () => {
    const clean = [mk({ ...A }), mk({ ...A, lat: A.lat + 0.002 })];
    const saturated = [
      mk({ ...B }),
      mk({ ...B, lat: B.lat + 0.002 }),
      ...Array.from({ length: 6 }, (_, i) => mk({ ...B, lat: B.lat + 0.004 + i * 0.001, lead_tier: 'has_site' })),
    ];
    const scored = scoreTerritories([...clean, ...saturated]);
    const cellA = scored.find((s) => Math.round(s.centroid.lat * 10) === Math.round(A.lat * 10))!;
    const cellB = scored.find((s) => Math.round(s.centroid.lat * 10) === Math.round(B.lat * 10))!;
    expect(cellA.saturation).toBe(0);
    expect(cellB.saturation).toBeGreaterThan(0.5);
    expect(cellA.score).toBeGreaterThan(cellB.score);
  });

  it('rewards demand (review volume) when rent and density are equal', () => {
    const scored = scoreTerritories([
      mk({ ...A, review_count: 0 }),
      mk({ ...A, lat: A.lat + 0.002, review_count: 0 }),
      mk({ ...B, review_count: 800 }),
      mk({ ...B, lat: B.lat + 0.002, review_count: 800 }),
    ]);
    const busy = scored.find((s) => s.demandProxy > 0)!;
    const quiet = scored.find((s) => s.demandProxy === 0)!;
    expect(busy.score).toBeGreaterThan(quiet.score);
  });

  it('labels a cell by its dominant city, and skips coordinate-less prospects', () => {
    const scored = scoreTerritories([
      mk({ ...A, city: 'Somerville', region: 'MA' }),
      mk({ ...A, lat: A.lat + 0.002, city: 'Somerville', region: 'MA' }),
      { ...mk({ ...A }), address_lat: null, address_lon: null }, // dropped
    ]);
    expect(scored).toHaveLength(1);
    expect(scored[0].label).toBe('Somerville, MA');
    expect(scored[0].count).toBe(2); // the null-coord row was not bucketed
  });
});
