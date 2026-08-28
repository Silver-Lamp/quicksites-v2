// lib/commerce/rentalSplits.ts
//
// How one geo-domain RENTAL payment divides between the closer, their manager, and
// Point Seven. Pure arithmetic — no DB, no Stripe — so the page, the API and the tests
// all agree by construction rather than by three people implementing the same rule.
//
// The napkin version of this was written in dollars ($50 / $15 / $35 of $99), which sums
// to $100 and hides the fact that it is a PERCENTAGE rule. Written as percentages it is
// exact at any price, which is why the constants below are shares and never amounts.
//
// Owner decisions, settled 2026-08-25 (see docs/RENTAL_SPLITS.md):
//   1. Split the NET, not the sticker price.
//   2. A manager closing their own sale takes the closer's 50% and no override.
//   3. Residuals continue while active, then a bounded tail.
//   4. A commission is earned when the payment sticks; a refund reverses it.
//   5. Plan on the $99 tier; treat $399 as upside.

/** Stripe US card pricing. Non-card and international rates differ — see feeNote(). */
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;

/**
 * Shares of the NET. The closer is always 50%. The manager's override rises when the
 * closer is someone they recruited, and that raise is funded ENTIRELY out of the house
 * share — never out of the closer's. Recruiting must never compete with selling.
 */
export const SPLIT = {
  closer: 0.5,
  managerStandard: 0.15,
  managerRecruit: 0.25,
} as const;

/** Months a departed rep keeps collecting before the residual stops. */
export const RESIDUAL_TAIL_MONTHS = 12;

/** A refund inside this window reverses the commission for that payment. */
export const CLAWBACK_WINDOW_DAYS = 120;

export type SplitVariant = 'standard' | 'recruit';

export type RentalSplit = {
  /** What the customer was charged. */
  grossCents: number;
  /** Stripe's cut of that charge. */
  feeCents: number;
  /** What actually landed, and the basis every share is taken from. */
  netCents: number;
  closerCents: number;
  managerCents: number;
  /** Point Seven. Takes the remainder, so the three always sum to net exactly. */
  houseCents: number;
  variant: SplitVariant;
  /** Effective share of NET each party received, for display. */
  shares: { closer: number; manager: number; house: number };
};

/** Stripe's fee on one successful card charge, in whole cents. */
export function stripeFeeCents(grossCents: number): number {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  if (gross === 0) return 0;
  return Math.round(gross * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
}

/**
 * Divide one rental payment.
 *
 * The house takes the REMAINDER rather than its own percentage. Three independently
 * rounded shares do not reliably sum to the total, and a split that is a cent off is
 * a split somebody has to reconcile by hand every month. Rounding dust therefore lands
 * in the house's slice, deliberately: it is the only party in a position to absorb it
 * and the only one who does not have to be told.
 */
export function splitRentalPayment(
  grossCents: number,
  variant: SplitVariant = 'standard'
): RentalSplit {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const feeCents = stripeFeeCents(gross);
  // A charge smaller than the fixed fee would otherwise produce a negative basis.
  const netCents = Math.max(0, gross - feeCents);

  const managerShare = variant === 'recruit' ? SPLIT.managerRecruit : SPLIT.managerStandard;

  const closerCents = Math.floor(netCents * SPLIT.closer);
  const managerCents = Math.floor(netCents * managerShare);
  const houseCents = netCents - closerCents - managerCents;

  return {
    grossCents: gross,
    feeCents,
    netCents,
    closerCents,
    managerCents,
    houseCents,
    variant,
    shares: {
      closer: netCents ? closerCents / netCents : 0,
      manager: netCents ? managerCents / netCents : 0,
      house: netCents ? houseCents / netCents : 0,
    },
  };
}

/**
 * What the same payment would have produced under the napkin's original rule — shares
 * taken off the STICKER price, with the house paying the processor out of its own slice.
 * Kept so the page can show the difference rather than assert it.
 */
export function splitOnGrossForComparison(
  grossCents: number,
  variant: SplitVariant = 'standard'
): { closerCents: number; managerCents: number; houseCents: number } {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const managerShare = variant === 'recruit' ? SPLIT.managerRecruit : SPLIT.managerStandard;
  const closerCents = Math.floor(gross * SPLIT.closer);
  const managerCents = Math.floor(gross * managerShare);
  // The house is paid last, so it is the house that absorbs the processor's fee.
  const houseCents = gross - stripeFeeCents(gross) - closerCents - managerCents;
  return { closerCents, managerCents, houseCents };
}

/** Monthly-equivalent of a price billed on some interval, for comparing rentals. */
export function monthlyEquivalentCents(amountCents: number, interval: string | null): number {
  const a = Math.max(0, Math.round(Number(amountCents) || 0));
  switch (interval) {
    case 'day':
      return Math.round(a * 30.4375);
    case 'week':
      return Math.round(a * (52 / 12));
    case 'year':
      return Math.round(a / 12);
    default:
      return a;
  }
}

/** Plain-language note on what the fee figure does and doesn't cover. */
export function feeNote(): string {
  return `Assumes Stripe's US card rate of ${(STRIPE_PERCENT * 100).toFixed(1)}% + ${STRIPE_FIXED_CENTS}¢ per successful charge. International cards, currency conversion and disputes cost more; ACH costs less.`;
}

export function formatCents(cents?: number | null): string {
  // Number(null) is 0, so the obvious guard renders a missing value as "$0.00" — which
  // on a payout page reads as "owed nothing" rather than "we don't know". Check for
  // absence before coercing.
  if (cents === null || cents === undefined) return '—';
  const v = Number(cents);
  if (!Number.isFinite(v)) return '—';
  return `$${(v / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
