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

export const MAX_PLATFORM_FEE_PERCENT =
  Number(process.env.QS_MAX_PLATFORM_FEE_PERCENT ?? '0.10') || 0.1;
export const PARTNER_FEE_SHARE = Number(process.env.QS_PARTNER_FEE_SHARE ?? '0.80') || 0.8;
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

// ─────────────────────────── Affiliate referral tier ───────────────────────────
//
// A RESELLER operates a book (onboards + supports + brands) and keeps 80% of the fee.
// An AFFILIATE just refers ("use code daniel") and earns a smaller lifetime residual —
// a SHARE OF THE PLATFORM FEE, auto-capped so QuickSites always keeps a floor after
// Stripe. This is the sustainable-yet-aggressive tier (see docs/REFERRAL_PRICING.md).
//
// The two tiers are told apart by referral_codes.owner_type: 'qs_affiliate' = affiliate
// (this tier); anything else ('provider_rep', …) = reseller (the 80% partner residual).

/** Default affiliate cut, as a share of the platform fee. */
export const AFFILIATE_FEE_SHARE = Number(process.env.QS_AFFILIATE_FEE_SHARE ?? '0.25') || 0.25;
/** Hard ceiling on any affiliate code's share of the fee (founding-cohort codes ride higher). */
export const AFFILIATE_MAX_FEE_SHARE =
  Number(process.env.QS_AFFILIATE_MAX_FEE_SHARE ?? '0.40') || 0.4;
/** Cents QuickSites must keep on an order AFTER Stripe, before any affiliate cut is paid. */
export const QS_MIN_NET_KEEP_CENTS = Number(process.env.QS_MIN_NET_KEEP_CENTS ?? '25') || 25;
/** Conservative Stripe processing estimate (destination charges → QS bears it). */
export const STRIPE_PCT = Number(process.env.QS_STRIPE_PCT ?? '0.029') || 0.029;
export const STRIPE_FIXED_CENTS = Number(process.env.QS_STRIPE_FIXED_CENTS ?? '30') || 30;

/** True for the affiliate tier (casual referrer), false for a reseller/operator. */
export function isAffiliateOwnerType(ownerType: string | null | undefined): boolean {
  return (ownerType ?? '') === 'qs_affiliate';
}

/** Conservative Stripe fee estimate on the order's total charge (for the net-safety cap). */
export function estimateStripeFeeCents(orderTotalCents: number): number {
  const total = Math.max(0, Number(orderTotalCents) || 0);
  return Math.round(total * STRIPE_PCT) + STRIPE_FIXED_CENTS;
}

/**
 * An affiliate's residual on one order — `shareOfFee × platform_fee`, but never more than
 * what keeps QuickSites at least QS_MIN_NET_KEEP_CENTS after Stripe. So the cut scales with
 * the fee yet an order can never go underwater from paying it. `shareOfFee` (the code's
 * plan.rate) is clamped to [0, AFFILIATE_MAX_FEE_SHARE].
 */
export function affiliateResidualCents(
  platformFeeCents: number,
  orderTotalCents: number,
  shareOfFee: number
): number {
  const fee = Math.max(0, Number(platformFeeCents) || 0);
  const share = Math.min(Math.max(Number(shareOfFee) || 0, 0), AFFILIATE_MAX_FEE_SHARE);
  const desired = Math.floor(fee * share);
  const netCap = Math.max(0, fee - estimateStripeFeeCents(orderTotalCents) - QS_MIN_NET_KEEP_CENTS);
  return Math.min(desired, netCap);
}
