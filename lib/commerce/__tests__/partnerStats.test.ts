// lib/commerce/__tests__/partnerStats.test.ts
//
// Verifies the partner residual aggregation behind /partners/dashboard (gap #6).
// The load-bearing property: "pending payout" (owed) = pending + approved, so a
// commission that the auto-approval cron moves pending -> approved doesn't vanish
// from a partner's visible balance before it's actually paid.

import { aggregatePartnerLedger } from '../partnerStats';

const led = (status: string, amount: number, order: string, currency = 'USD') => ({
  status,
  amount_cents: amount,
  currency,
  subject_id: order,
});

// order id -> merchant id
const o2m = (pairs: Array<[string, string]>) => new Map(pairs);

describe('aggregatePartnerLedger', () => {
  it('sums totals by status and derives owed = pending + approved', () => {
    const r = aggregatePartnerLedger({
      ledgerRows: [led('pending', 100, 'o1'), led('approved', 200, 'o2'), led('paid', 300, 'o3')],
      orderToMerchant: o2m([
        ['o1', 'm1'],
        ['o2', 'm1'],
        ['o3', 'm1'],
      ]),
      attributedMerchantIds: ['m1'],
    });
    expect(r.totals).toEqual({ pending: 100, approved: 200, paid: 300 });
  });

  it('keeps approved in the per-merchant owed bucket (not just lifetime earned)', () => {
    const r = aggregatePartnerLedger({
      ledgerRows: [led('pending', 100, 'o1'), led('approved', 250, 'o2'), led('paid', 50, 'o3')],
      orderToMerchant: o2m([
        ['o1', 'm1'],
        ['o2', 'm1'],
        ['o3', 'm1'],
      ]),
      attributedMerchantIds: ['m1'],
    });
    const m1 = r.perMerchant.find((m) => m.merchantId === 'm1')!;
    expect(m1.earned).toBe(400); // 100 + 250 + 50
    expect(m1.owed).toBe(350); // pending 100 + approved 250 — the key fix
    expect(m1.pending).toBe(100);
    expect(m1.approved).toBe(250);
    expect(m1.paid).toBe(50);
    expect(m1.orderCount).toBe(3);
  });

  it('seeds attributed merchants with zero earnings so referrals still show', () => {
    const r = aggregatePartnerLedger({
      ledgerRows: [],
      orderToMerchant: o2m([]),
      attributedMerchantIds: ['m1', 'm2'],
    });
    expect(r.perMerchant).toHaveLength(2);
    expect(r.perMerchant.every((m) => m.earned === 0 && m.owed === 0 && m.orderCount === 0)).toBe(
      true
    );
  });

  it('splits earnings across merchants and sorts by earned desc', () => {
    const r = aggregatePartnerLedger({
      ledgerRows: [led('paid', 100, 'o1'), led('pending', 900, 'o2'), led('approved', 400, 'o3')],
      orderToMerchant: o2m([
        ['o1', 'm1'],
        ['o2', 'm2'],
        ['o3', 'm2'],
      ]),
      attributedMerchantIds: ['m1', 'm2'],
    });
    expect(r.perMerchant.map((m) => m.merchantId)).toEqual(['m2', 'm1']); // m2 earned 1300 > m1 100
    const m2 = r.perMerchant[0];
    expect(m2.owed).toBe(1300); // 900 pending + 400 approved
    expect(m2.paid).toBe(0);
  });

  it('counts totals even for ledger rows whose order maps to no known merchant', () => {
    // The commission still counts toward the partner's balance; it just can't be
    // attributed to a merchant row.
    const r = aggregatePartnerLedger({
      ledgerRows: [led('pending', 500, 'orphan')],
      orderToMerchant: o2m([]),
      attributedMerchantIds: [],
    });
    expect(r.totals.pending).toBe(500);
    expect(r.perMerchant).toHaveLength(0);
  });

  it('applies nameFor and carries currency from the ledger', () => {
    const r = aggregatePartnerLedger({
      ledgerRows: [led('paid', 100, 'o1', 'EUR')],
      orderToMerchant: o2m([['o1', 'm1']]),
      attributedMerchantIds: ['m1'],
      nameFor: (id) => (id === 'm1' ? 'Acme Co' : id),
    });
    expect(r.currency).toBe('EUR');
    expect(r.perMerchant[0].name).toBe('Acme Co');
  });

  it('coerces missing/invalid amounts to 0', () => {
    const r = aggregatePartnerLedger({
      ledgerRows: [
        { status: 'pending', amount_cents: null, subject_id: 'o1' },
        { status: 'approved', subject_id: 'o1' },
      ],
      orderToMerchant: o2m([['o1', 'm1']]),
      attributedMerchantIds: ['m1'],
    });
    expect(r.totals).toEqual({ pending: 0, approved: 0, paid: 0 });
    expect(r.perMerchant[0].owed).toBe(0);
  });
});
