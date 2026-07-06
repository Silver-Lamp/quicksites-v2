// lib/commerce/partner-terms.ts
//
// Partner / reseller economics (the offer at /partners; see docs/MONETIZATION.md).
//
// Model: hosting is free. A partner sets the merchant's per-order platform fee
// (capped). On every order, QuickSites keeps a fixed SHARE of that fee and the
// partner keeps the rest — as a lifetime residual, tracked in commission_ledger.
//
// Defaults (env-overridable):
//   - Partner may set the order fee up to 10%   (QS_MAX_PLATFORM_FEE_PERCENT)
//   - Partner keeps 80% of each fee             (QS_PARTNER_FEE_SHARE)
//   - QuickSites keeps the remaining 20%
//   - Residual is lifetime                      (QS_RESIDUAL_MONTHS = 0 → no limit)

export const MAX_PLATFORM_FEE_PERCENT = Number(process.env.QS_MAX_PLATFORM_FEE_PERCENT ?? '0.10') || 0.10;
export const PARTNER_FEE_SHARE = Number(process.env.QS_PARTNER_FEE_SHARE ?? '0.80') || 0.80;
export const QS_FEE_SHARE = Math.max(0, 1 - PARTNER_FEE_SHARE);
/** 0 = lifetime (no time limit). */
export const RESIDUAL_MONTHS = Number(process.env.QS_RESIDUAL_MONTHS ?? '0') || 0;
/** Days a commission stays 'pending' before it can be approved for payout (refund window). */
export const REFUND_WINDOW_DAYS = Number(process.env.QS_REFUND_WINDOW_DAYS ?? '14') || 14;

/** The partner's residual on one order's platform fee (their share, in cents). */
export function partnerCommissionCents(platformFeeCents: number): number {
  return Math.floor(Math.max(0, Number(platformFeeCents) || 0) * PARTNER_FEE_SHARE);
}

/** Clamp a requested order-fee percent to the partner cap (0..MAX). */
export function clampPlatformFeePercent(pct: number): number {
  const v = Number(pct) || 0;
  return Math.min(Math.max(v, 0), MAX_PLATFORM_FEE_PERCENT);
}

/**
 * A "hub" recruits resellers and earns a configurable, lifetime override on their
 * orders. The override is funded OUT OF QuickSites' share: clamp it to
 * [0, QS_FEE_SHARE] so the reseller's 80% residual is never touched and QS's net
 * can't go negative. Returns the hub's cut of one order's platform fee, in cents.
 */
export function clampOverrideShare(share: number): number {
  const v = Number(share) || 0;
  return Math.min(Math.max(v, 0), QS_FEE_SHARE);
}
export function hubOverrideCents(platformFeeCents: number, overrideShare: number): number {
  const fee = Math.max(0, Number(platformFeeCents) || 0);
  return Math.floor(fee * clampOverrideShare(overrideShare));
}
