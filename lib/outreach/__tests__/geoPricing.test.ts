/**
 * @jest-environment node
 */
// lib/outreach/__tests__/geoPricing.test.ts

import { priceTier, suggestPricing, deriveRankStatus, effectivePriceCents } from '@/lib/outreach/geoPricing';

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
