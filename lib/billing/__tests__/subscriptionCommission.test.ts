// lib/billing/__tests__/subscriptionCommission.test.ts
//
// The subscription commission is a recurring partner residual funded from the
// merchant's QuickSites subscription. Load-bearing properties: it respects the
// residual duration window, floors to whole cents, and never records a
// non-positive amount.

import {
  computeSubscriptionCommission,
  monthsBetween,
  type ReferralPlan,
} from '@/lib/billing/subscriptionCommission';

const UNIX = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe('monthsBetween', () => {
  // Uses local-time getMonth()/getFullYear() (faithful to the original webhook);
  // mid-month/midday values keep the assertions timezone-robust.
  it('counts whole calendar months', () => {
    expect(monthsBetween('2026-01-15T12:00:00Z', UNIX('2026-01-20T12:00:00Z'))).toBe(0);
    expect(monthsBetween('2026-01-15T12:00:00Z', UNIX('2026-04-15T12:00:00Z'))).toBe(3);
    expect(monthsBetween('2025-11-15T12:00:00Z', UNIX('2026-02-15T12:00:00Z'))).toBe(3);
  });
});

describe('computeSubscriptionCommission', () => {
  const percentPlan: ReferralPlan = { type: 'percent', rate: 0.2, duration_months: 12 };

  it('takes the configured percent of the invoice total, floored to cents', () => {
    const r = computeSubscriptionCommission({
      plan: percentPlan,
      invoiceTotalCents: 4999, // $49.99
      firstTouchAt: '2026-01-15T12:00:00Z',
      invoiceCreatedUnix: UNIX('2026-02-15T12:00:00Z'),
    });
    expect(r).toEqual({ amountCents: 999, recorded: true }); // 4999 * 0.2 = 999.8 → 999
  });

  it('pays a flat_cents plan', () => {
    const r = computeSubscriptionCommission({
      plan: { type: 'flat_cents', flat_cents: 500 },
      invoiceTotalCents: 4999,
    });
    expect(r).toEqual({ amountCents: 500, recorded: true });
  });

  it('is lifetime when duration_months is 0/absent', () => {
    const r = computeSubscriptionCommission({
      plan: { type: 'percent', rate: 0.1 }, // no duration
      invoiceTotalCents: 10000,
      firstTouchAt: '2020-01-15T12:00:00Z',
      invoiceCreatedUnix: UNIX('2026-06-15T12:00:00Z'), // years later
    });
    expect(r).toEqual({ amountCents: 1000, recorded: true });
  });

  it('stops paying once the duration window has elapsed', () => {
    const r = computeSubscriptionCommission({
      plan: percentPlan, // 12 months
      invoiceTotalCents: 4999,
      firstTouchAt: '2026-01-15T12:00:00Z',
      invoiceCreatedUnix: UNIX('2027-01-15T12:00:00Z'), // exactly 12 months → elapsed
    });
    expect(r).toEqual({ amountCents: 0, recorded: false, reason: 'duration_elapsed' });
  });

  it('still pays inside the window (11 of 12 months)', () => {
    const r = computeSubscriptionCommission({
      plan: percentPlan,
      invoiceTotalCents: 4999,
      firstTouchAt: '2026-01-15T12:00:00Z',
      invoiceCreatedUnix: UNIX('2026-12-15T12:00:00Z'), // 11 months
    });
    expect(r.recorded).toBe(true);
  });

  it('skips with a reason on no plan / no total / zero amount', () => {
    expect(computeSubscriptionCommission({ plan: null, invoiceTotalCents: 4999 })).toEqual({
      amountCents: 0,
      recorded: false,
      reason: 'no_plan',
    });
    expect(computeSubscriptionCommission({ plan: percentPlan, invoiceTotalCents: 0 })).toEqual({
      amountCents: 0,
      recorded: false,
      reason: 'no_total',
    });
    // 1 cent * 0.2 = 0.2 → floor 0 → not recorded
    expect(
      computeSubscriptionCommission({ plan: { type: 'percent', rate: 0.2 }, invoiceTotalCents: 1 }),
    ).toEqual({ amountCents: 0, recorded: false, reason: 'zero_amount' });
  });

  it('does not apply the window when created time or first touch is missing', () => {
    // duration set but no invoiceCreatedUnix → window check skipped, pays
    const r = computeSubscriptionCommission({
      plan: percentPlan,
      invoiceTotalCents: 5000,
      firstTouchAt: '2020-01-15T12:00:00Z',
    });
    expect(r).toEqual({ amountCents: 1000, recorded: true });
  });
});
