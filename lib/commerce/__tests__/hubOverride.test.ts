// lib/commerce/__tests__/hubOverride.test.ts
//
// The hub override is a second-tier residual funded OUT OF QuickSites' share. The
// load-bearing property: it can never exceed QS_FEE_SHARE (so QS net can't go
// negative and the reseller's 80% is never touched).

import { hubOverrideCents, clampOverrideShare, QS_FEE_SHARE, PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';

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
