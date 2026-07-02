// lib/commerce/__tests__/revenue.test.ts
//
// Verifies the platform-revenue reconciliation math (gap punch-list #2): the
// dashboard's headline "QuickSites net take" and "partners owed" numbers. The
// take-rate model keeps 20% of the fee and owes 80% to attributed partners, so
// net take = gross fees on paid orders − the non-void residual against them.

import { summarizePlatformRevenue, reconcileStripeFees } from '../revenue';

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

describe('reconcileStripeFees', () => {
  it('matches when Stripe net equals our recorded gross', () => {
    const r = reconcileStripeFees(
      [{ amount: 500, amount_refunded: 0 }, { amount: 300, amount_refunded: 0 }],
      800,
    );
    expect(r.stripe_fee_gross_cents).toBe(800);
    expect(r.stripe_fee_net_cents).toBe(800);
    expect(r.db_fee_gross_cents).toBe(800);
    expect(r.delta_cents).toBe(0);
    expect(r.matched).toBe(true);
    expect(r.fee_count).toBe(2);
  });

  it('nets out reversed fees so a refunded order reconciles against DB paid-gross', () => {
    // One $5 fee still live, one $3 fee fully reversed → Stripe net 500; DB paid
    // gross excludes the refunded order → 500. Reconciled.
    const r = reconcileStripeFees(
      [{ amount: 500, amount_refunded: 0 }, { amount: 300, amount_refunded: 300 }],
      500,
    );
    expect(r.stripe_fee_gross_cents).toBe(800);
    expect(r.stripe_fee_refunded_cents).toBe(300);
    expect(r.stripe_fee_net_cents).toBe(500);
    expect(r.matched).toBe(true);
  });

  it('flags drift with a signed delta (Stripe net − DB gross)', () => {
    const r = reconcileStripeFees([{ amount: 800, amount_refunded: 0 }], 750);
    expect(r.delta_cents).toBe(50); // Stripe collected 50¢ more than we recorded
    expect(r.matched).toBe(false);

    const under = reconcileStripeFees([{ amount: 700, amount_refunded: 0 }], 750);
    expect(under.delta_cents).toBe(-50);
    expect(under.matched).toBe(false);
  });

  it('is null-safe for empty input and missing fields', () => {
    const r = reconcileStripeFees([], 0);
    expect(r).toMatchObject({ stripe_fee_gross_cents: 0, stripe_fee_net_cents: 0, delta_cents: 0, matched: true, fee_count: 0 });
    const r2 = reconcileStripeFees([{}, { amount: 100 }] as any, 100);
    expect(r2.stripe_fee_gross_cents).toBe(100);
    expect(r2.stripe_fee_refunded_cents).toBe(0);
    expect(r2.matched).toBe(true);
  });
});
