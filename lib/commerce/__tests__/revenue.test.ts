// lib/commerce/__tests__/revenue.test.ts
//
// Verifies the platform-revenue reconciliation math (gap punch-list #2): the
// dashboard's headline "QuickSites net take" and "partners owed" numbers. The
// take-rate model keeps 20% of the fee and owes 80% to attributed partners, so
// net take = gross fees on paid orders − the non-void residual against them.

import { summarizePlatformRevenue } from '../revenue';

const order = (status: string, total: number, fee: number) => ({
  status,
  total_cents: total,
  platform_fee_cents: fee,
});

describe('summarizePlatformRevenue', () => {
  it('counts only paid orders in GMV and gross fees; refunds bucket separately', () => {
    const s = summarizePlatformRevenue({
      orders: [
        order('paid', 10000, 800),
        order('paid', 5000, 400),
        order('refunded', 3000, 240),
        order('pending', 9999, 999), // ignored: neither paid nor refunded
      ],
      commissions: [],
    });
    expect(s.orders).toEqual({ paid: 2, refunded: 1 });
    expect(s.gmv_cents).toBe(15000);
    expect(s.platform_fee_cents).toBe(1200);
    expect(s.refunded_gmv_cents).toBe(3000);
    expect(s.refunded_fee_cents).toBe(240);
  });

  it('net take equals gross fees when no orders are attributed to a partner', () => {
    const s = summarizePlatformRevenue({
      orders: [order('paid', 10000, 800)],
      commissions: [],
    });
    expect(s.qs_net_cents).toBe(800); // QS keeps 100% of an unattributed fee
    expect(s.partner_residual_cents).toEqual({ owed: 0, paid: 0, void: 0 });
  });

  it('subtracts the partner share (owed + paid) from gross to get net take', () => {
    // $8.00 fee, 80% residual = $6.40; owed 640, QS keeps 160.
    const s = summarizePlatformRevenue({
      orders: [order('paid', 10000, 800)],
      commissions: [{ status: 'pending', amount_cents: 640 }],
    });
    expect(s.partner_residual_cents.owed).toBe(640);
    expect(s.qs_net_cents).toBe(160);
  });

  it('treats pending and approved alike as "owed"', () => {
    const s = summarizePlatformRevenue({
      orders: [order('paid', 20000, 1000)],
      commissions: [
        { status: 'pending', amount_cents: 300 },
        { status: 'approved', amount_cents: 500 },
      ],
    });
    expect(s.partner_residual_cents).toEqual({ owed: 800, paid: 0, void: 0 });
    expect(s.qs_net_cents).toBe(200); // 1000 − 800
  });

  it('counts paid residual against net but keeps it out of "owed"', () => {
    const s = summarizePlatformRevenue({
      orders: [order('paid', 20000, 1000)],
      commissions: [
        { status: 'approved', amount_cents: 200 },
        { status: 'paid', amount_cents: 600 },
      ],
    });
    expect(s.partner_residual_cents).toEqual({ owed: 200, paid: 600, void: 0 });
    expect(s.qs_net_cents).toBe(200); // 1000 − (200 owed + 600 paid)
  });

  it('excludes void residuals (reversed on refund) from what QS owes/keeps', () => {
    // The refunded order's fee is already out of platform_fee_cents (paid-only),
    // and its residual is void — so neither should dent the paid order's net take.
    const s = summarizePlatformRevenue({
      orders: [order('paid', 10000, 800), order('refunded', 5000, 400)],
      commissions: [
        { status: 'pending', amount_cents: 640 }, // paid order's residual
        { status: 'void', amount_cents: 320 }, // refunded order's reversed residual
      ],
    });
    expect(s.partner_residual_cents).toEqual({ owed: 640, paid: 0, void: 320 });
    expect(s.qs_net_cents).toBe(160); // 800 − 640; the void 320 is ignored
  });

  it('is null-safe for missing/empty inputs', () => {
    const s = summarizePlatformRevenue({ orders: [], commissions: [] });
    expect(s.qs_net_cents).toBe(0);
    expect(s.gmv_cents).toBe(0);
    expect(s.partner_residual_cents).toEqual({ owed: 0, paid: 0, void: 0 });
  });

  it('coerces missing numeric fields to 0', () => {
    const s = summarizePlatformRevenue({
      orders: [{ status: 'paid' } as any],
      commissions: [{ status: 'pending' } as any],
    });
    expect(s.platform_fee_cents).toBe(0);
    expect(s.partner_residual_cents.owed).toBe(0);
    expect(s.qs_net_cents).toBe(0);
  });
});
