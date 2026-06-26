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

/** The partner's residual on one order's platform fee (their share, in cents). */
export function partnerCommissionCents(platformFeeCents: number): number {
  return Math.floor(Math.max(0, Number(platformFeeCents) || 0) * PARTNER_FEE_SHARE);
}

/** Clamp a requested order-fee percent to the partner cap (0..MAX). */
export function clampPlatformFeePercent(pct: number): number {
  const v = Number(pct) || 0;
  return Math.min(Math.max(v, 0), MAX_PLATFORM_FEE_PERCENT);
}
