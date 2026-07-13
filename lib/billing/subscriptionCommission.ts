// lib/billing/subscriptionCommission.ts
//
// Pure commission math for recurring (subscription) revenue — the partner residual
// on a paid QuickSites subscription invoice. Kept side-effect-free so it's unit
// testable; the billing webhook (app/api/billing/webhooks/stripe) does the Stripe
// verification + Supabase reads/writes and delegates the money math here.

/** Referral plan shape stored on referral_codes.plan (jsonb). */
export type ReferralPlan = {
  type?: 'percent' | 'flat_cents' | string;
  rate?: number; // for type 'percent' (0..1)
  flat_cents?: number; // for type 'flat_cents'
  duration_months?: number; // 0/absent = lifetime
};

export type CommissionInput = {
  plan: ReferralPlan | null | undefined;
  /** invoice.total in integer cents. */
  invoiceTotalCents: number | null | undefined;
  /** attributions.first_touch_at (ISO) — anchors the duration window. */
  firstTouchAt?: string | null;
  /** invoice.created in unix seconds — "now" for the window check. */
  invoiceCreatedUnix?: number | null;
};

export type CommissionResult =
  | { amountCents: number; recorded: true }
  | { amountCents: 0; recorded: false; reason: 'no_plan' | 'no_total' | 'duration_elapsed' | 'zero_amount' };

/**
 * Whole months between two dates (calendar-month granularity, matching the
 * webhook's original behavior: year*12 + month delta).
 */
export function monthsBetween(startIso: string, nowUnixSeconds: number): number {
  const start = new Date(startIso);
  const now = new Date(nowUnixSeconds * 1000);
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}

/**
 * Compute the partner commission (integer cents) for one paid subscription
 * invoice. Returns recorded:false with a reason when nothing should be written
 * (no plan, zero invoice, past the duration window, or a non-positive amount) so
 * the caller can skip the ledger upsert without duplicating the branching.
 */
export function computeSubscriptionCommission(input: CommissionInput): CommissionResult {
  const { plan, invoiceTotalCents, firstTouchAt, invoiceCreatedUnix } = input;

  if (!plan || !plan.type) return { amountCents: 0, recorded: false, reason: 'no_plan' };

  const totalCents = Number(invoiceTotalCents || 0);
  if (totalCents <= 0) return { amountCents: 0, recorded: false, reason: 'no_total' };

  // Respect the residual duration window (0/absent = lifetime).
  const duration = Number(plan.duration_months || 0);
  if (duration > 0 && firstTouchAt && typeof invoiceCreatedUnix === 'number') {
    if (monthsBetween(firstTouchAt, invoiceCreatedUnix) >= duration) {
      return { amountCents: 0, recorded: false, reason: 'duration_elapsed' };
    }
  }

  let amountCents = 0;
  if (plan.type === 'percent') {
    amountCents = Math.floor(totalCents * Number(plan.rate || 0));
  } else if (plan.type === 'flat_cents') {
    amountCents = Math.floor(Number(plan.flat_cents || 0));
  }

  if (amountCents <= 0) return { amountCents: 0, recorded: false, reason: 'zero_amount' };
  return { amountCents, recorded: true };
}
