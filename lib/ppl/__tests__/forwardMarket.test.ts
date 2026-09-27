// lib/ppl/__tests__/forwardMarket.test.ts
//
// "IN THIS MARKET" — distance rather than the city label, and the collision that created.
//
// ⚠️ `outreach_prospects.city` is the city we SEARCHED, not where the business is: `runSweep`
// stamps `input.city` onto every result, so a sweep with an 8 km bias labels businesses 40 km
// away with the town at its centre. Matching on that name asks "did we happen to discover you
// under this label", which is not the question. Maple Valley qualified 1 of 13 real candidates
// on the name test.
import {
  recommendForwardTargets,
  deconflictTopPicks,
  marketMatch,
  type ForwardProspect,
  type ForwardCampaign,
} from '../forwardCandidates';
import { marketRadiusKm, isDispatchTrade, DEFAULT_MARKET_RADIUS_KM } from '../marketRadius';

const NOW = new Date('2026-09-27T00:00:00Z');
const FRESH = '2026-09-27T00:00:00Z';

// Real coordinates, so the distances in these tests are the distances on the ground.
const MAPLE_VALLEY = { lat: 47.3663, lon: -122.0442 };
const SEATTLE = { lat: 47.6062, lon: -122.3321 };

function prospect(over: Partial<ForwardProspect> & { id: string }): ForwardProspect {
  return {
    business_name: `Biz ${over.id}`,
    phone: '2535550100',
    website: null,
    city: 'Anywhere',
    region: 'WA',
    industry_key: 'towing',
    rating: 4.5,
    review_count: 40,
    status: 'draft_built',
    created_at: FRESH,
    last_seen_at: FRESH,
    address_lat: MAPLE_VALLEY.lat,
    address_lon: MAPLE_VALLEY.lon,
    ...over,
  };
}

const CAMPAIGN: ForwardCampaign = {
  id: 'mv',
  domain: 'maplevalley-towing.com',
  city: 'Maple Valley',
  region: 'WA',
  industry_key: 'towing',
  center_lat: MAPLE_VALLEY.lat,
  center_lon: MAPLE_VALLEY.lon,
};

describe('marketRadiusKm', () => {
  it('gives a dispatch trade room to drive', () => {
    // A tow truck comes to you; a shop 20 km away serves the town perfectly well.
    expect(marketRadiusKm('towing')).toBeGreaterThanOrEqual(20);
    expect(isDispatchTrade('towing')).toBe(true);
  });

  it('keeps a premises business tight, because the CUSTOMER travels', () => {
    // The case a single global radius would silently get wrong.
    expect(marketRadiusKm('restaurant')).toBeLessThanOrEqual(10);
    expect(marketRadiusKm('restaurant')).toBeLessThan(marketRadiusKm('towing'));
    expect(isDispatchTrade('restaurant')).toBe(false);
  });

  it('falls back to a narrow default for an unknown trade', () => {
    expect(marketRadiusKm('llama_grooming')).toBe(DEFAULT_MARKET_RADIUS_KM);
    expect(marketRadiusKm(null)).toBe(DEFAULT_MARKET_RADIUS_KM);
  });
});

describe('marketMatch', () => {
  it('uses distance when both sides have coordinates', () => {
    const m = marketMatch(prospect({ id: 'near' }), CAMPAIGN);
    expect(m.by).toBe('distance');
    expect(m.inMarket).toBe(true);
    expect(m.km).toBeCloseTo(0, 1);
  });

  it('excludes a business beyond the trade radius', () => {
    // Seattle is ~38 km from Maple Valley — outside towing's 25 km.
    const m = marketMatch(
      prospect({ id: 'far', address_lat: SEATTLE.lat, address_lon: SEATTLE.lon }),
      CAMPAIGN,
    );
    expect(m.by).toBe('distance');
    expect(m.inMarket).toBe(false);
    expect(m.km).toBeGreaterThan(25);
  });

  it('includes a business the CITY LABEL would have excluded', () => {
    // The Maple Valley bug: parked under "Renton" by an earlier sweep, but 0 km from the town.
    const p = prospect({ id: 'mislabelled', city: 'Renton' });
    expect(marketMatch(p, CAMPAIGN).inMarket).toBe(true);
    const out = recommendForwardTargets(CAMPAIGN, [p], { now: NOW });
    expect(out.ranked).toHaveLength(1);
  });

  it('falls back to the city name when the campaign has no centre', () => {
    const noCentre: ForwardCampaign = { ...CAMPAIGN, center_lat: null, center_lon: null };
    const m = marketMatch(prospect({ id: 'x', city: 'Maple Valley' }), noCentre);
    expect(m.by).toBe('city');
    expect(m.inMarket).toBe(true);
    expect(marketMatch(prospect({ id: 'y', city: 'Renton' }), noCentre).inMarket).toBe(false);
  });

  it('keeps the region guard on the fallback only', () => {
    // Covington WA vs Covington GA: the name test needs region, distance does not — the two
    // towns are 3,800 km apart, and re-applying region on the distance path would exclude a
    // business ten minutes across a state line that genuinely serves the town.
    const noCentre: ForwardCampaign = {
      ...CAMPAIGN,
      city: 'Covington',
      region: 'WA',
      center_lat: null,
      center_lon: null,
    };
    const ga = prospect({ id: 'ga', city: 'Covington', region: 'GA' });
    expect(recommendForwardTargets(noCentre, [ga], { now: NOW }).disqualified[0].reason).toBe(
      'region_mismatch',
    );
  });

  it('reports outside_market rather than city_mismatch on the distance path', () => {
    const out = recommendForwardTargets(
      CAMPAIGN,
      [prospect({ id: 'far', address_lat: SEATTLE.lat, address_lon: SEATTLE.lon })],
      { now: NOW },
    );
    expect(out.disqualified[0].reason).toBe('outside_market');
  });
});

describe('deconflictTopPicks', () => {
  // Two overlapping campaigns, one shared best business sitting ON the first town.
  const near: ForwardCampaign = { ...CAMPAIGN, id: 'mv', domain: 'maplevalley-towing.com' };
  const far: ForwardCampaign = {
    ...CAMPAIGN,
    id: 'cov',
    domain: 'covingtontow.com',
    city: 'Covington',
    center_lat: 47.3573,
    center_lon: -122.1215,
  };

  function build() {
    const shared = prospect({ id: 'shared', business_name: 'Shared Towing', phone: '2530000001', rating: 5, review_count: 300 });
    const other = prospect({ id: 'other', business_name: 'Other Towing', phone: '2530000002', rating: 4.0, review_count: 20 });
    return [
      recommendForwardTargets(near, [shared, other], { now: NOW }),
      recommendForwardTargets(far, [shared, other], { now: NOW }),
    ];
  }

  it('without deconfliction one business is the top pick for both', () => {
    const [a, b] = build();
    expect(a.ranked[0].prospect.id).toBe('shared');
    expect(b.ranked[0].prospect.id).toBe('shared');
  });

  it('gives the business to the campaign whose town it is CLOSEST to', () => {
    // Resolved by distance, not by score: score says which market rates it highest, which is
    // not a fact about who it serves.
    const out = deconflictTopPicks(build());
    const byDomain = Object.fromEntries(out.map((r) => [r.campaign.domain, r]));
    expect(byDomain['maplevalley-towing.com'].ranked[0].prospect.id).toBe('shared');
    expect(byDomain['covingtontow.com'].ranked[0].prospect.id).toBe('other');
  });

  it('tells the displaced campaign why it moved', () => {
    const out = deconflictTopPicks(build());
    const cov = out.find((r) => r.campaign.domain === 'covingtontow.com')!;
    expect(cov.ranked[0].flags.join(' ')).toMatch(/closer to another campaign/);
  });

  it('a displaced pick is never auto-applied', () => {
    const out = deconflictTopPicks(build());
    expect(out.every((r) => r.autoApplyEligible === false)).toBe(true);
  });

  it('is stable — the same input resolves the same way regardless of order', () => {
    const a = deconflictTopPicks(build()).map((r) => `${r.campaign.domain}:${r.ranked[0]?.prospect.id}`);
    const b = deconflictTopPicks(build().reverse()).map((r) => `${r.campaign.domain}:${r.ranked[0]?.prospect.id}`);
    expect(b.sort()).toEqual(a.sort());
  });

  it('reports honestly when every candidate went elsewhere rather than reusing one', () => {
    const only = prospect({ id: 'only', phone: '2530000009', rating: 5, review_count: 100 });
    const out = deconflictTopPicks([
      recommendForwardTargets(near, [only], { now: NOW }),
      recommendForwardTargets(far, [only], { now: NOW }),
    ]);
    const cov = out.find((r) => r.campaign.domain === 'covingtontow.com')!;
    expect(cov.ranked).toHaveLength(0);
    expect(cov.pool.advice).toMatch(/closer fit for a neighbouring campaign/);
    expect(cov.autoApplyEligible).toBe(false);
  });
});
