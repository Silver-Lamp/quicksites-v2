// lib/commerce/partnerEarnings.ts
//
// Client-safe partner earnings math, shared by the /partners/calculator page and
// the /rebuild "what you'd have earned" overlay. lib/commerce/partner-terms.ts is
// the server source of truth but reads QS_* env (not in the client bundle), so we
// mirror its DEFAULTS here as plain constants. Keep these in sync with that file.

/** Partner keeps this share of each order's platform fee (mirrors PARTNER_FEE_SHARE). */
export const PARTNER_FEE_SHARE = 0.8;
/** Max per-order fee a partner can set (mirrors MAX_PLATFORM_FEE_PERCENT). */
export const MAX_FEE_PCT = 0.1;
/** A sensible mid-range default fee for estimates. */
export const DEFAULT_FEE_PCT = 0.08;

function clamp(n: number, lo: number, hi: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.min(Math.max(v, lo), hi);
}

/**
 * A partner's residual on a given monthly GMV: GMV × fee% × partner share,
 * recurring for the life of the merchant. Pure — safe on client or server.
 */
export function estimatePartnerResidual(opts: {
  monthlyGmv: number;
  feePct?: number; // 0..MAX_FEE_PCT (clamped)
  partnerShare?: number; // defaults to PARTNER_FEE_SHARE
}): { monthly: number; annual: number; feePct: number } {
  const feePct = clamp(opts.feePct ?? DEFAULT_FEE_PCT, 0, MAX_FEE_PCT);
  const share = clamp(opts.partnerShare ?? PARTNER_FEE_SHARE, 0, 1);
  const gmv = Math.max(0, Number(opts.monthlyGmv) || 0);
  const monthly = gmv * feePct * share;
  return { monthly, annual: monthly * 12, feePct };
}
