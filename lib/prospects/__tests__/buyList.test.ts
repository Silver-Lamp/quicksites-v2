/**
 * @jest-environment node
 */
// lib/prospects/__tests__/buyList.test.ts

import {
  buildBuyList,
  fillBudget,
  type BuyListProspect,
  type BuyCandidate,
} from '@/lib/prospects/buyList';

// priceTier tiers (from lib/outreach/geoPricing.ts):
//   PREMIUM (towing/plumbing/hvac/…) full 39900 / locked 9900
//   MID     (landscaping/…)          full 19900 / locked 7900
//   LOW     (salon_spa/…)            full  9900 / locked 4900

const p = (over: Partial<BuyListProspect>): BuyListProspect => ({
  city: over.city ?? 'Boston',
  region: over.region ?? 'MA',
  industry_key: over.industry_key ?? 'towing',
  lead_tier: over.lead_tier ?? 'no_website',
  review_count: over.review_count ?? null,
});

/** N no-website prospects for a city×industry. */
function noSite(city: string, industry: string, n: number): BuyListProspect[] {
  return Array.from({ length: n }, () => p({ city, industry_key: industry, lead_tier: 'no_website' }));
}

describe('buildBuyList — scoring', () => {
  it('derives the exact-match domain + slug per city×industry', () => {
    const [c] = buildBuyList(noSite('Boston', 'towing', 2));
    expect(c.domain).toBe('boston-towing.com');
    expect(c.slug).toBe('boston-towing');
    expect(c.industryKey).toBe('towing');
  });

  it('uses the nicer industry domain word (roof_cleaning → roofing)', () => {
    const [c] = buildBuyList(noSite('Quincy', 'roof_cleaning', 2));
    expect(c.domain).toBe('quincy-roofing.com');
  });

  it('prices from the industry tier (premium full/locked rent)', () => {
    const [c] = buildBuyList(noSite('Boston', 'towing', 1));
    expect(c.monthlyRentCents).toBe(39900);
    expect(c.lockedRentCents).toBe(9900);
  });

  it('ranks a premium trade above a low-ticket one, all else equal', () => {
    const list = buildBuyList([...noSite('Boston', 'towing', 1), ...noSite('Boston', 'salon_spa', 1)]);
    expect(list[0].industryKey).toBe('towing');
    expect(list[1].industryKey).toBe('salon_spa');
    expect(list[0].score).toBeGreaterThan(list[1].score);
  });

  it('boosts demand by no-website competitor count (sub-linear, capped)', () => {
    const list = buildBuyList([...noSite('Boston', 'towing', 5), ...noSite('Quincy', 'towing', 1)]);
    const boston = list.find((c) => c.city === 'Boston')!;
    const quincy = list.find((c) => c.city === 'Quincy')!;
    expect(boston.demandFactor).toBeCloseTo(1 + 0.1 * 5);
    expect(quincy.demandFactor).toBeCloseTo(1 + 0.1 * 1);
    expect(boston.score).toBeGreaterThan(quincy.score);
  });

  it('caps the demand boost so it cannot dominate lead value', () => {
    const [c] = buildBuyList(noSite('Boston', 'towing', 999), { maxDemandCompetitors: 10 });
    expect(c.demandFactor).toBeCloseTo(1 + 0.1 * 10); // capped at 10, not 999
  });

  it('penalizes winnability by incumbent saturation but never zeros it', () => {
    // 4 have-site, 0 no-website → saturation 1.0 → winnability floored, not 0.
    const allSites = Array.from({ length: 4 }, () => p({ city: 'Dense', industry_key: 'towing', lead_tier: 'has_site' }));
    const [c] = buildBuyList(allSites);
    expect(c.saturation).toBe(1);
    expect(c.winnability).toBeGreaterThan(0);
    expect(c.winnability).toBeCloseTo(0.5); // 1 - 0.5*1 = 0.5 (above the 0.1 floor)
  });

  it('soft SEO ground (low saturation) outranks a saturated cell of the same trade', () => {
    const soft = noSite('Soft', 'towing', 2); // saturation 0
    const hard = [
      p({ city: 'Hard', industry_key: 'towing', lead_tier: 'no_website' }),
      ...Array.from({ length: 3 }, () => p({ city: 'Hard', industry_key: 'towing', lead_tier: 'has_site' })),
    ]; // 1 no-website of 4 → higher saturation, lower demand
    const list = buildBuyList([...soft, ...hard]);
    expect(list[0].city).toBe('Soft');
  });

  it('filters to the requested industries', () => {
    const list = buildBuyList([...noSite('Boston', 'towing', 1), ...noSite('Boston', 'salon_spa', 1)], {
      industries: ['towing'],
    });
    expect(list).toHaveLength(1);
    expect(list[0].industryKey).toBe('towing');
  });

  it('honors minGroup but never drops an explicit candidate', () => {
    const list = buildBuyList(noSite('Boston', 'towing', 1), {
      minGroup: 3,
      candidates: [{ city: 'Boston', industryKey: 'towing' }],
    });
    // Below minGroup (1 < 3) but forced via candidates → kept.
    expect(list).toHaveLength(1);
    expect(list[0].totalProspects).toBe(1);
  });

  it('includes zero-demand explicit candidates with no swept prospects', () => {
    const list = buildBuyList([], { candidates: [{ city: 'Renton', region: 'WA', industryKey: 'plumbing' }] });
    expect(list).toHaveLength(1);
    expect(list[0].domain).toBe('renton-plumbing.com');
    expect(list[0].totalProspects).toBe(0);
    expect(list[0].demandFactor).toBe(1); // no competitors → neutral
    expect(list[0].winnability).toBe(1); // no incumbents → full
  });

  it('drops rows below minGroup that were not forced', () => {
    const list = buildBuyList(noSite('Boston', 'towing', 1), { minGroup: 2 });
    expect(list).toHaveLength(0);
  });
});

describe('buildBuyList — map-pack strength (competitor reviews)', () => {
  const withReviews = (city: string, industry: string, reviews: number[]): BuyListProspect[] =>
    reviews.map((r) => p({ city, industry_key: industry, lead_tier: 'has_site', review_count: r }));

  it('degrades to v1 when there is no review data (neutral factor)', () => {
    const [c] = buildBuyList(noSite('Boston', 'towing', 2));
    expect(c.competitorReviews).toBeNull();
    expect(c.reviewSample).toBe(0);
    expect(c.packStrength).toBeNull();
    expect(c.weakPackFactor).toBe(1);
  });

  it('reports the median competitor review count + sample size', () => {
    const [c] = buildBuyList(withReviews('Boston', 'towing', [4, 10, 100]));
    expect(c.competitorReviews).toBe(10); // median of [4,10,100]
    expect(c.reviewSample).toBe(3);
    expect(c.packStrength).toBeCloseTo(10 / (10 + 25));
  });

  it('boosts a weak pack (few reviews) above a strong pack of the same trade', () => {
    const weak = buildBuyList(withReviews('Weakville', 'towing', [1, 2, 3]));
    const strong = buildBuyList(withReviews('Strongtown', 'towing', [300, 400, 500]));
    expect(weak[0].weakPackFactor).toBeGreaterThan(1);
    expect(strong[0].weakPackFactor).toBeLessThan(1);
    // Same trade + same saturation → the weak pack must score higher.
    const merged = buildBuyList([
      ...withReviews('Weakville', 'towing', [1, 2, 3]),
      ...withReviews('Strongtown', 'towing', [300, 400, 500]),
    ]);
    expect(merged[0].city).toBe('Weakville');
  });

  it('keeps the pack factor within [1−reviewWeight, 1+reviewWeight]', () => {
    const weak = buildBuyList(withReviews('Z', 'towing', [0, 0, 0]))[0];
    const strong = buildBuyList(withReviews('Z', 'towing', [9999]))[0];
    expect(weak.weakPackFactor).toBeCloseTo(1.4); // default reviewWeight 0.4
    expect(strong.weakPackFactor).toBeCloseTo(0.6);
  });

  it('respects minReviewSample (ignores thin review evidence)', () => {
    const [c] = buildBuyList(withReviews('Boston', 'towing', [2]), { minReviewSample: 3 });
    expect(c.reviewSample).toBe(1);
    expect(c.weakPackFactor).toBe(1); // below the sample floor → neutral
  });
});

describe('fillBudget — greedy budget fill', () => {
  const cands = (): BuyCandidate[] =>
    buildBuyList([
      ...noSite('Boston', 'towing', 5),
      ...noSite('Quincy', 'towing', 3),
      ...noSite('Malden', 'plumbing', 2),
    ]);

  it('accepts hottest-first until the budget is spent', () => {
    const res = fillBudget(cands(), { budgetUsd: 24, defaultPriceUsd: 12 });
    expect(res.count).toBe(2);
    expect(res.totalSpendUsd).toBe(24);
    // Everything after the first two is over budget, not silently dropped.
    expect(res.skipped.every((s) => s.reason === 'over_budget')).toBe(true);
  });

  it('keeps scanning past an over-budget row for a cheaper one that still fits', () => {
    const list = cands();
    // Price the top candidate high, the rest cheap; budget fits a couple of cheap ones.
    const availabilityByDomain = { [list[0].domain]: { available: true, priceUsd: 100 } };
    const res = fillBudget(list, { budgetUsd: 25, defaultPriceUsd: 12, availabilityByDomain });
    expect(res.accepted.find((c) => c.domain === list[0].domain)).toBeUndefined();
    expect(res.count).toBe(2); // two $12 domains fit in $25
    expect(res.skipped.find((s) => s.candidate.domain === list[0].domain)?.reason).toBe('over_budget');
  });

  it('skips unavailable and premium domains', () => {
    const list = cands();
    const availabilityByDomain = {
      [list[0].domain]: { available: false, priceUsd: null },
      [list[1].domain]: { available: true, premium: true, priceUsd: 500 },
    };
    const res = fillBudget(list, { budgetUsd: 1000, defaultPriceUsd: 12, availabilityByDomain });
    expect(res.accepted.find((c) => c.domain === list[0].domain)).toBeUndefined();
    expect(res.accepted.find((c) => c.domain === list[1].domain)).toBeUndefined();
    expect(res.skipped.find((s) => s.candidate.domain === list[0].domain)?.reason).toBe('unavailable');
    expect(res.skipped.find((s) => s.candidate.domain === list[1].domain)?.reason).toBe('premium');
  });

  it('honors a per-industry cap to spread the bet', () => {
    const res = fillBudget(cands(), { budgetUsd: 1000, defaultPriceUsd: 12, perIndustryCap: { towing: 1 } });
    const towing = res.accepted.filter((c) => c.industryKey === 'towing');
    expect(towing).toHaveLength(1);
    expect(res.skipped.some((s) => s.reason === 'industry_cap')).toBe(true);
  });

  it('projects both founder (locked) and full MRR across accepted domains', () => {
    const res = fillBudget(cands(), { budgetUsd: 1000, defaultPriceUsd: 12 });
    // 3 candidates: 2 towing + 1 plumbing, all PREMIUM (locked 9900 / full 39900).
    expect(res.count).toBe(3);
    expect(res.projectedMonthlyRentCents).toBe(3 * 9900);
    expect(res.projectedFullMonthlyRentCents).toBe(3 * 39900);
  });
});
