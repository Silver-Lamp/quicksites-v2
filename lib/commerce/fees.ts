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

/**
 * Flat per-order shipping fee, in cents, for a cart that contains a physical /
 * print-on-demand item that has to ship. Off (returns 0) unless
 * QS_POD_SHIPPING_CENTS is set — so this is inert until a merchant/operator
 * opts in. Shipping is deliberately excluded from the platform-fee basis (we
 * take our cut of the merchant's product margin, not the carrier's fee).
 */
export function flatShippingCents(hasShippable: boolean): number {
  if (!hasShippable) return 0;
  const c = Math.floor(Number(process.env.QS_POD_SHIPPING_CENTS ?? '0')) || 0;
  return Math.max(0, c);
}

/**
 * Pull the sales tax + charged total from a Stripe event. Only Checkout Session
 * events (`checkout.session.*`) carry a `total_details.amount_tax` breakdown when
 * Stripe `automatic_tax` is on; PaymentIntent events don't, so both fields come
 * back null and the caller skips. Amounts are integer cents.
 *
 * Tax is charged on top of the merchant's subtotal and is deliberately NOT part
 * of the platform-fee basis (we take a cut of the merchant's margin, not the
 * government's tax) — this helper only surfaces what the buyer actually paid so
 * the order row, receipt, and reconciliation stay truthful.
 */
export function parseStripeTaxTotals(rawEvent: any): { taxCents: number | null; totalCents: number | null } {
  const obj = rawEvent?.data?.object ?? null;
  const amountTax = obj?.total_details?.amount_tax;
  const amountTotal = obj?.amount_total;
  return {
    taxCents: Number.isFinite(amountTax) ? Math.max(0, Math.floor(amountTax)) : null,
    totalCents: Number.isFinite(amountTotal) ? Math.max(0, Math.floor(amountTotal)) : null,
  };
}
