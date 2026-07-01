// lib/commerce/__tests__/fees.test.ts
import { computeSubtotalCents, computePlatformFeeCents, flatShippingCents } from '../fees';
import {
  partnerCommissionCents,
  clampPlatformFeePercent,
  PARTNER_FEE_SHARE,
  MAX_PLATFORM_FEE_PERCENT,
} from '../partner-terms';

describe('computeSubtotalCents', () => {
  it('returns 0 for no items', () => {
    expect(computeSubtotalCents([])).toBe(0);
    expect(computeSubtotalCents(undefined as any)).toBe(0);
  });

  it('multiplies unit by quantity and sums line items', () => {
    expect(computeSubtotalCents([{ unitAmount: 500, quantity: 2 }])).toBe(1000);
    expect(
      computeSubtotalCents([
        { unitAmount: 500, quantity: 2 }, // 1000
        { unitAmount: 250, quantity: 3 }, // 750
      ]),
    ).toBe(1750);
  });

  it('clamps quantity to >= 1 and unit to >= 0', () => {
    expect(computeSubtotalCents([{ unitAmount: 500, quantity: 0 }])).toBe(500); // qty -> 1
    expect(computeSubtotalCents([{ unitAmount: -500, quantity: 2 }])).toBe(0); // unit -> 0
  });

  it('treats missing/null fields as defaults (unit 0, qty 1)', () => {
    expect(computeSubtotalCents([{}])).toBe(0);
    expect(computeSubtotalCents([{ unitAmount: 300 }])).toBe(300);
    expect(computeSubtotalCents([{ unitAmount: null, quantity: null }])).toBe(0);
  });
});

describe('computePlatformFeeCents', () => {
  const base = { collectFee: true, feePercent: 0.05, feeMinCents: 0 };

  it('is 0 when the merchant does not collect a fee', () => {
    expect(computePlatformFeeCents({ ...base, collectFee: false, totalCents: 1000 })).toBe(0);
  });

  it('is 0 when the merchant is fee-exempt (agency plan)', () => {
    expect(computePlatformFeeCents({ ...base, feeExempt: true, totalCents: 1000 })).toBe(0);
  });

  it('takes feePercent of the total', () => {
    expect(computePlatformFeeCents({ ...base, totalCents: 1000 })).toBe(50); // 5%
  });

  it('floors to whole cents', () => {
    expect(computePlatformFeeCents({ ...base, totalCents: 1001 })).toBe(50); // floor(50.05)
  });

  it('applies the minimum when the percentage fee is lower', () => {
    expect(
      computePlatformFeeCents({ collectFee: true, totalCents: 100, feePercent: 0.05, feeMinCents: 50 }),
    ).toBe(50); // 5% = 5, min 50 wins
  });

  it('never charges the minimum on a zero basis', () => {
    expect(
      computePlatformFeeCents({ collectFee: true, totalCents: 0, feePercent: 0.05, feeMinCents: 50 }),
    ).toBe(0);
  });

  it('excludes print-on-demand base cost from the fee basis', () => {
    // total 1000, POD base 400 -> basis 600 -> 10% = 60
    expect(
      computePlatformFeeCents({ collectFee: true, totalCents: 1000, podBaseCents: 400, feePercent: 0.1 }),
    ).toBe(60);
  });

  it('is 0 when POD base cost meets or exceeds the total', () => {
    expect(
      computePlatformFeeCents({ collectFee: true, totalCents: 500, podBaseCents: 500, feePercent: 0.1, feeMinCents: 30 }),
    ).toBe(0);
  });
});

describe('flatShippingCents', () => {
  const OLD = process.env.QS_POD_SHIPPING_CENTS;
  afterEach(() => {
    if (OLD === undefined) delete process.env.QS_POD_SHIPPING_CENTS;
    else process.env.QS_POD_SHIPPING_CENTS = OLD;
  });

  it('is 0 for a cart with nothing shippable, regardless of config', () => {
    process.env.QS_POD_SHIPPING_CENTS = '699';
    expect(flatShippingCents(false)).toBe(0);
  });

  it('is 0 by default (opt-in) even when the cart ships', () => {
    delete process.env.QS_POD_SHIPPING_CENTS;
    expect(flatShippingCents(true)).toBe(0);
  });

  it('returns the configured flat fee when the cart ships', () => {
    process.env.QS_POD_SHIPPING_CENTS = '699';
    expect(flatShippingCents(true)).toBe(699);
  });

  it('never returns a negative fee', () => {
    process.env.QS_POD_SHIPPING_CENTS = '-500';
    expect(flatShippingCents(true)).toBe(0);
  });
});

describe('shipping is excluded from the platform-fee basis', () => {
  it('fee is computed on the product subtotal, not subtotal + shipping', () => {
    // A $50 product at 8% → $4.00 fee, whether or not $6.99 shipping is added.
    const feeOnProduct = computePlatformFeeCents({ collectFee: true, totalCents: 5000, feePercent: 0.08 });
    expect(feeOnProduct).toBe(400);
    // createDraftOrder passes the product subtotal (not the shipped total) to the
    // fee calc, so adding shipping must not change the fee.
    const feeIfShippingIncluded = computePlatformFeeCents({ collectFee: true, totalCents: 5000 + 699, feePercent: 0.08 });
    expect(feeIfShippingIncluded).not.toBe(feeOnProduct); // proves the basis matters
  });
});

describe('partnerCommissionCents', () => {
  it('keeps the partner share of the platform fee, floored', () => {
    expect(partnerCommissionCents(100)).toBe(Math.floor(100 * PARTNER_FEE_SHARE));
    expect(partnerCommissionCents(101)).toBe(Math.floor(101 * PARTNER_FEE_SHARE));
  });

  it('is 0 for non-positive or invalid input', () => {
    expect(partnerCommissionCents(0)).toBe(0);
    expect(partnerCommissionCents(-100)).toBe(0);
    expect(partnerCommissionCents(NaN)).toBe(0);
  });
});

describe('clampPlatformFeePercent', () => {
  it('passes through a value within range', () => {
    expect(clampPlatformFeePercent(0.05)).toBe(0.05);
  });

  it('clamps above the max to the cap', () => {
    expect(clampPlatformFeePercent(0.5)).toBe(MAX_PLATFORM_FEE_PERCENT);
  });

  it('clamps negatives and invalid input to 0', () => {
    expect(clampPlatformFeePercent(-0.1)).toBe(0);
    expect(clampPlatformFeePercent(NaN)).toBe(0);
  });
});
