/**
 * @jest-environment node
 */
import { planSweepQueue, measuredRates, NO_WEBSITE_PRIOR } from '@/lib/tradeSites/queuePlanner';
import { resolveSweepCategory } from '@/lib/prospects/sweepCategories';

const categoryFor = (industry: string) => resolveSweepCategory(industry)?.label ?? null;
const now = new Date('2026-09-08T00:00:00Z');

describe('the queue planner ranks from what we own and what we measured', () => {
  it('puts an owned domain in a high-rate trade first, and explains why', () => {
    const { plan } = planSweepQueue({
      now,
      categoryFor,
      alreadyQueued: [],
      campaigns: [
        { city: 'Franklin', region: 'WI', industry_key: 'towing', domain: 'franklin-towing.com' },
        { city: 'Boston', region: 'MA', industry_key: 'roofing', domain: 'boston-roofing.com' },
      ],
      history: [],
    });
    expect(plan[0].city).toBe('Franklin');
    expect(plan[0].category).toBe('Towing');
    expect(plan[0].reasons.join(' ')).toMatch(/we own franklin-towing.com/);
    expect(plan[0].reasons.join(' ')).toMatch(/no website, prior/);
    // Roofing is a trade found by search — 3% no website — so it ranks last even with a domain.
    expect(plan[plan.length - 1].industry).toBe('roofing');
  });

  it('a measured rate replaces the prior once ten businesses have been seen', () => {
    const rates = measuredRates([
      { city: 'Arab', region: 'AL', industry_key: 'towing', total: 21, noWebsite: 11, lastSweptAt: '2026-09-07' },
      { city: 'X', region: 'AL', industry_key: 'plumbing', total: 4, noWebsite: 4, lastSweptAt: '2026-09-07' },
    ]);
    expect(rates.towing.rate).toBeCloseTo(11 / 21, 3);
    expect(rates.plumbing).toBeUndefined(); // four is not evidence
    expect(NO_WEBSITE_PRIOR.towing).toBeGreaterThan(NO_WEBSITE_PRIOR.roofing);
  });

  it('skips a pair swept inside the cooldown — a re-sweep dedupes on place_id and finds nothing', () => {
    const { plan, skipped } = planSweepQueue({
      now,
      categoryFor,
      alreadyQueued: [],
      campaigns: [{ city: 'Arab', region: 'AL', industry_key: 'towing', domain: 'arab-towing.com' }],
      history: [{ city: 'Arab', region: 'AL', industry_key: 'towing', total: 21, noWebsite: 11, lastSweptAt: '2026-09-07T00:00:00Z' }],
    });
    expect(plan).toHaveLength(0);
    expect(skipped[0].why).toMatch(/swept 1 day ago/);
  });

  it('never plans a restaurant, and never a pair already queued', () => {
    const { plan, skipped } = planSweepQueue({
      now,
      categoryFor,
      alreadyQueued: [{ city: 'Kent', region: 'WA', category: 'Towing' }],
      campaigns: [
        { city: 'Paterson', region: 'NJ', industry_key: 'restaurant', domain: 'paterson-restaurant.com' },
        { city: 'Kent', region: 'WA', industry_key: 'towing', domain: 'kent-towing.com' },
      ],
      history: [],
    });
    expect(plan).toHaveLength(0);
    expect(skipped.map((s) => s.why).sort()).toEqual(['already queued', 'not a trade']);
  });

  it('a pair that measured under 10% is pushed down, not out', () => {
    const { plan } = planSweepQueue({
      now,
      categoryFor,
      alreadyQueued: [],
      campaigns: [
        { city: 'A', region: 'WA', industry_key: 'plumbing', domain: 'a-plumbing.com' },
        { city: 'B', region: 'WA', industry_key: 'plumbing', domain: 'b-plumbing.com' },
      ],
      history: [{ city: 'A', region: 'WA', industry_key: 'plumbing', total: 25, noWebsite: 1, lastSweptAt: '2026-01-01T00:00:00Z' }],
    });
    expect(plan.map((p) => p.city)).toEqual(['B', 'A']);
    expect(plan[1].reasons.join(' ')).toMatch(/measured 1\/25 last time/);
  });

  it('every industry we own a campaign domain in has a sweep category', () => {
    // 100 campaigns as of 2026-09-07: towing, hvac, plumbing, roof_cleaning, electrical,
    // general_contractor, windshield_repair, auto_repair. Two of these had no category until now.
    for (const k of ['towing', 'hvac', 'plumbing', 'roof_cleaning', 'electrical', 'general_contractor', 'windshield_repair', 'auto_repair']) {
      expect(categoryFor(k)).toBeTruthy();
    }
  });
});
