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

// ⚠️ THE MIRROR HAD NOTHING PINNING IT TO THE SOURCE, WHICH IS THE FAILURE THIS REPO KEEPS FINDING.
// `partnerEarnings.ts` exists because `partner-terms.ts` reads QS_* env and cannot be imported into
// a client bundle, and its header says "keep these in sync with that file" — a remembered
// instruction, not a derived check. Every assertion above imports its expected value FROM the
// mirror, so editing one file and not the other stayed green. A number survives if something
// re-derives it (CLAUDE.md §4).
//
// Falsifying condition worth stating: this compares DEFAULTS. It cannot catch a deploy that sets
// QS_PARTNER_FEE_SHARE server-side while the client keeps showing 80% — that divergence is real and
// unfixable by mirroring, which is why `components/commissions/scenario-lab.tsx` takes the constants
// as PROPS from the server instead of importing either module.
describe('the client mirror matches the server source', () => {
  const source = require('@/lib/commerce/partner-terms');
  const mirror = require('@/lib/commerce/partnerEarnings');

  it('PARTNER_FEE_SHARE agrees', () => {
    expect(mirror.PARTNER_FEE_SHARE).toBe(source.PARTNER_FEE_SHARE);
  });

  it('the fee cap agrees', () => {
    expect(mirror.MAX_FEE_PCT).toBe(source.MAX_PLATFORM_FEE_PERCENT);
  });

  it('the mirror default fee is inside the cap it mirrors', () => {
    expect(mirror.DEFAULT_FEE_PCT).toBeLessThanOrEqual(source.MAX_PLATFORM_FEE_PERCENT);
  });
});
