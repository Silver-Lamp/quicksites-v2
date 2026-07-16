// lib/commerce/__tests__/revenueDetail.test.ts
//
// Row-shaping for the /admin/revenue drill-downs: raw Supabase rows (with the
// merchants embed in either object or array form) normalize to the stable wire
// shape, and commission rows split residual vs hub-override by subject.

import {
  shapeOrderDetailRows,
  shapeCommissionDetailRows,
  isRevenueDetailKind,
} from '../revenueDetail';

describe('isRevenueDetailKind', () => {
  it('accepts the three kinds and rejects everything else', () => {
    expect(isRevenueDetailKind('paid_orders')).toBe(true);
    expect(isRevenueDetailKind('refunded_orders')).toBe(true);
    expect(isRevenueDetailKind('commissions')).toBe(true);
    expect(isRevenueDetailKind('orders')).toBe(false);
    expect(isRevenueDetailKind(null)).toBe(false);
  });
});

describe('shapeOrderDetailRows', () => {
  it('normalizes fields and reads the merchant embed as object or array', () => {
    const rows = shapeOrderDetailRows([
      {
        id: 'o1',
        site_slug: 'taco-town',
        status: 'paid',
        total_cents: 4800,
        platform_fee_cents: 288,
        created_at: '2026-07-01T00:00:00Z',
        merchants: { display_name: 'Taco Town' },
      },
      {
        id: 'o2',
        merchants: [{ display_name: 'Array Merchant' }],
      },
    ]);
    expect(rows[0]).toMatchObject({
      id: 'o1',
      merchant: 'Taco Town',
      site_slug: 'taco-town',
      total_cents: 4800,
      platform_fee_cents: 288,
    });
    expect(rows[1].merchant).toBe('Array Merchant');
    // Missing numerics coerce to 0, missing strings to placeholders.
    expect(rows[1].total_cents).toBe(0);
    expect(rows[1].site_slug).toBe('—');
  });
});

describe('shapeCommissionDetailRows', () => {
  it('splits residual vs hub override by subject', () => {
    const rows = shapeCommissionDetailRows([
      { id: 'c1', referral_code: 'REP1', subject: 'order_platform_fee', subject_id: 'o1', amount_cents: 640, status: 'pending' },
      { id: 'c2', referral_code: 'HUB1', subject: 'order_platform_fee_override', subject_id: 'o1', amount_cents: 32, status: 'paid' },
    ]);
    expect(rows[0].kind).toBe('residual');
    expect(rows[1].kind).toBe('override');
    expect(rows[1].amount_cents).toBe(32);
  });
});
