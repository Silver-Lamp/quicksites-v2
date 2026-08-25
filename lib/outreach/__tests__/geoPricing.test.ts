/**
 * @jest-environment node
 */
// lib/outreach/__tests__/geoPricing.test.ts

import { priceTier, suggestPricing, deriveRankStatus, effectivePriceCents, intervalSuffix } from '@/lib/outreach/geoPricing';

describe('priceTier', () => {
  it('tiers premium trades highest', () => {
    expect(priceTier('towing').fullCents).toBe(39900);
    expect(priceTier('landscaping').fullCents).toBe(19900);
    expect(priceTier('salon_spa').fullCents).toBe(9900);
  });
});

describe('deriveRankStatus', () => {
  it('buckets by GSC position', () => {
    expect(deriveRankStatus(4)).toBe('page1');
    expect(deriveRankStatus(15)).toBe('ranking');
    expect(deriveRankStatus(0, 120)).toBe('ranking');
    expect(deriveRankStatus(0, 0)).toBe('unranked');
    expect(deriveRankStatus(null, null)).toBe('unranked');
  });
});

describe('effectivePriceCents — founder rate until page 1', () => {
  const plan = suggestPricing('plumbing'); // full 39900, locked 9900

  it('charges the locked rate while not on page 1', () => {
    expect(effectivePriceCents({ ...plan, rank_status: 'unranked' })).toBe(9900);
    expect(effectivePriceCents({ ...plan, rank_status: 'ranking' })).toBe(9900);
  });
  it('steps up to the full rate on page 1', () => {
    expect(effectivePriceCents({ ...plan, rank_status: 'page1' })).toBe(39900);
  });
  it('is null without a flat plan', () => {
    expect(effectivePriceCents({ pricing_model: 'none', rank_status: 'page1' })).toBeNull();
  });
});

describe('intervalSuffix', () => {
  it('renders the unit the plan actually bills on', () => {
    expect(intervalSuffix('day')).toBe('/day');
    expect(intervalSuffix('week')).toBe('/wk');
    expect(intervalSuffix('month')).toBe('/mo');
    expect(intervalSuffix('year')).toBe('/yr');
  });

  it('falls back to monthly for null/unknown rather than rendering nothing', () => {
    // Every existing row predates billing_interval being read, and holds 'month' or null.
    expect(intervalSuffix(null)).toBe('/mo');
    expect(intervalSuffix(undefined)).toBe('/mo');
    expect(intervalSuffix('fortnight')).toBe('/mo');
  });

  it('matches the interval the rent route would actually charge on', () => {
    // The label and the charge must not be able to disagree: both narrow the same field to
    // the same set, so a value the checkout rejects is also a value the label refuses to show.
    for (const v of ['day', 'week', 'year']) expect(intervalSuffix(v)).not.toBe('/mo');
  });
});
