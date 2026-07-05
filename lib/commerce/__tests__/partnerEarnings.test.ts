// lib/commerce/__tests__/partnerEarnings.test.ts
//
// The shared partner-earnings estimator drives both /partners/calculator and the
// /rebuild "what you'd have earned" overlay, so its math is user-facing revenue
// framing — pin it. Mirrors the defaults in lib/commerce/partner-terms.ts.

import {
  DEFAULT_FEE_PCT,
  MAX_FEE_PCT,
  PARTNER_FEE_SHARE,
  estimatePartnerResidual,
} from '@/lib/commerce/partnerEarnings';

describe('estimatePartnerResidual', () => {
  it('computes GMV × fee% × partner share, monthly and annual', () => {
    const r = estimatePartnerResidual({ monthlyGmv: 10_000, feePct: 0.08 });
    expect(r.monthly).toBeCloseTo(10_000 * 0.08 * PARTNER_FEE_SHARE); // 640
    expect(r.annual).toBeCloseTo(r.monthly * 12);
    expect(r.feePct).toBe(0.08);
  });

  it('defaults the fee to DEFAULT_FEE_PCT when omitted', () => {
    const r = estimatePartnerResidual({ monthlyGmv: 5_000 });
    expect(r.feePct).toBe(DEFAULT_FEE_PCT);
    expect(r.monthly).toBeCloseTo(5_000 * DEFAULT_FEE_PCT * PARTNER_FEE_SHARE);
  });

  it('clamps the fee to the partner cap', () => {
    const r = estimatePartnerResidual({ monthlyGmv: 1_000, feePct: 0.5 });
    expect(r.feePct).toBe(MAX_FEE_PCT);
  });

  it('floors negative / non-finite GMV to zero', () => {
    expect(estimatePartnerResidual({ monthlyGmv: -100 }).monthly).toBe(0);
    expect(estimatePartnerResidual({ monthlyGmv: NaN }).monthly).toBe(0);
  });

  it('respects an explicit partner share override', () => {
    const r = estimatePartnerResidual({ monthlyGmv: 10_000, feePct: 0.1, partnerShare: 0.5 });
    expect(r.monthly).toBeCloseTo(10_000 * 0.1 * 0.5); // 500
  });
});
