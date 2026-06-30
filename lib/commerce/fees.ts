// lib/commerce/fees.ts
//
// Pure money math for the order path, extracted from createDraftOrder so it can
// be unit-tested in isolation (no Supabase). All amounts are integer cents.
// Keep these free of I/O and framework imports.

/** Sum of line items: Σ max(0, unitAmount) × max(1, quantity), in cents. */
export function computeSubtotalCents(items: Array<{ quantity?: number | null; unitAmount?: number | null }>): number {
  return (items ?? []).reduce((sum, li) => {
    const qty = Math.max(1, Number(li?.quantity ?? 1) || 1);
    const unit = Math.max(0, Number(li?.unitAmount ?? 0) || 0);
    return sum + unit * qty;
  }, 0);
}

/**
 * The platform take-rate on an order, in cents.
 *
 * - No fee when the merchant doesn't collect one, or is fee-exempt (agency plan).
 * - The fee basis excludes print-on-demand base cost (we only take a cut of the
 *   merchant's margin, not the printer's cost).
 * - The fee is `feeBasis × percent` floored to whole cents, but at least
 *   `minCents` — and the minimum only applies when there's a positive basis
 *   (a $0 basis never incurs the minimum).
 */
export function computePlatformFeeCents(input: {
  totalCents: number;
  podBaseCents?: number;
  collectFee: boolean;
  feeExempt?: boolean;
  /** Fraction in [0, 1], e.g. 0.05 for 5%. */
  feePercent?: number;
  feeMinCents?: number;
}): number {
  const {
    totalCents,
    podBaseCents = 0,
    collectFee,
    feeExempt = false,
    feePercent = 0,
    feeMinCents = 0,
  } = input;

  if (!collectFee || feeExempt) return 0;

  const feeBasis = Math.max(0, totalCents - podBaseCents);
  const pctFee = Math.floor(feeBasis * (feePercent || 0));
  const floor = feeBasis > 0 ? feeMinCents || 0 : 0;
  return Math.max(pctFee, floor);
}
