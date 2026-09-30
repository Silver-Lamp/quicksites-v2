// lib/commerce/__tests__/hubOverride.test.ts
//
// The hub override is a second-tier residual funded OUT OF QuickSites' share. The
// load-bearing property: it can never exceed QS_FEE_SHARE (so QS net can't go
// negative and the reseller's 80% is never touched).

import {
  hubOverrideCents,
  clampOverrideShare,
  QS_FEE_SHARE,
  PARTNER_FEE_SHARE,
  uplinePoolShare,
  ORIGINATION_UPLINE_POOL_SHARE,
  AFFILIATE_FEE_SHARE,
  AFFILIATE_MAX_FEE_SHARE,
} from '@/lib/commerce/partner-terms';
import { buildUplineChain, allocateUplineOverrides } from '@/lib/commerce/uplineChain';

describe('clampOverrideShare', () => {
  it('clamps to [0, QS_FEE_SHARE]', () => {
    expect(clampOverrideShare(0.05)).toBe(0.05);
    expect(clampOverrideShare(0.5)).toBe(QS_FEE_SHARE); // capped at QS's 20%
    expect(clampOverrideShare(-1)).toBe(0);
    expect(clampOverrideShare(NaN as any)).toBe(0);
  });
});

describe('hubOverrideCents', () => {
  it('takes the configured cut of the platform fee', () => {
    // $8.00 fee, 5% override → $0.40
    expect(hubOverrideCents(800, 0.05)).toBe(40);
    // 10% → $0.80
    expect(hubOverrideCents(800, 0.1)).toBe(80);
  });

  it('never exceeds QuickSites share (so QS + reseller stay whole)', () => {
    const fee = 800;
    const override = hubOverrideCents(fee, 0.9); // asks for 90%, clamped to 20%
    expect(override).toBe(Math.floor(fee * QS_FEE_SHARE)); // 160
    // reseller residual (80%) + max override (20%) never exceeds the fee
    const reseller = Math.floor(fee * PARTNER_FEE_SHARE);
    expect(reseller + override).toBeLessThanOrEqual(fee);
  });

  it('floors to whole cents and handles zero/garbage', () => {
    expect(hubOverrideCents(999, 0.05)).toBe(49); // 49.95 → 49
    expect(hubOverrideCents(800, 0)).toBe(0);
    expect(hubOverrideCents(0, 0.1)).toBe(0);
    expect(hubOverrideCents(-5, 0.1)).toBe(0);
  });
});

describe('the upline pool depends on who sold it (2026-09-30, the ISO channel)', () => {
  // ⚠️ THE 80% IS AN OPERATING MARGIN, NOT A CLOSING COMMISSION. An operator supports the
  // merchant and keeps most of the fee, so little is left to share upward. An origination chain
  // closes and moves on — QuickSites supports that merchant — so the closer keeps less and more
  // of the fee is available above the sale.
  it('an operator sale shares only the house slice', () => {
    expect(uplinePoolShare('provider_rep')).toBeCloseTo(QS_FEE_SHARE, 10);
    expect(uplinePoolShare(null)).toBeCloseTo(QS_FEE_SHARE, 10);
  });

  it('an origination sale shares more, because the house retained more', () => {
    expect(uplinePoolShare('qs_affiliate')).toBeGreaterThan(QS_FEE_SHARE);
    expect(uplinePoolShare('qs_affiliate')).toBeCloseTo(ORIGINATION_UPLINE_POOL_SHARE, 10);
  });

  // ⚠️ The invariant the whole override design promises: an upline is NEVER funded out of the
  // closer's residual. The pool is capped at what the tier can actually spare, so even a
  // misconfigured env cannot reach past it.
  it('never exceeds what the tier leaves after the closer is paid', () => {
    expect(uplinePoolShare('qs_affiliate')).toBeLessThanOrEqual(1 - AFFILIATE_MAX_FEE_SHARE);
    expect(uplinePoolShare('provider_rep')).toBeLessThanOrEqual(1 - PARTNER_FEE_SHARE + 1e-9);
  });

  // The measured case from the call: three levels at 5% each. Under the old flat 20% pool the
  // fourth person earned nothing and the house earned nothing; under the origination pool the
  // chain fits and the house still has something to support the merchant with.
  it('makes a three-level origination chain payable', () => {
    const fee = 500; // $50 order at 10%
    const nodes: Record<string, { parentCode: string | null; overrideShare: number }> = {
      closer: { parentCode: 'iso', overrideShare: 0.05 },
      iso: { parentCode: 'recruiter', overrideShare: 0.05 },
      recruiter: { parentCode: 'referrer', overrideShare: 0.05 },
      referrer: { parentCode: null, overrideShare: 0 },
    };
    const chain = buildUplineChain('closer', (c) => nodes[c]);
    const a = allocateUplineOverrides(fee, chain, uplinePoolShare('qs_affiliate'));
    expect(a.shorted).toHaveLength(0);
    expect(a.payments).toHaveLength(3);
    const closer = Math.floor(fee * AFFILIATE_FEE_SHARE);
    expect(fee - closer - a.totalCents).toBeGreaterThan(0);
  });
});
