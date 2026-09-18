// lib/ppl/rules.ts
//
// Pay-per-call billing rules — pure, no I/O, so every money decision is unit-testable.
// Everything in integer cents. Defaults mirror the ppl_accounts column defaults.

export const PPL_DEFAULTS = {
  cplCents: 8500,
  minBillableSeconds: 90,
  reloadThresholdCents: 30000,
  reloadAmountCents: 120000,
  /** A business may contest a charge this long after it posts. */
  disputeWindowHours: 72,
} as const;

export type PplAccountLike = {
  cpl_cents: number;
  min_billable_seconds: number;
  reload_threshold_cents: number;
  reload_amount_cents: number;
  auto_reload: boolean;
  balance_cents: number;
  status: 'pending' | 'active' | 'paused' | 'closed';
};

/** Only a call that reached the business and lasted long enough to be a conversation is a lead. */
export function isBillableCall(args: {
  dialStatus: string | null | undefined;
  connectedSeconds: number;
  minBillableSeconds: number;
}):
  | { billable: true; reason: 'completed' }
  | { billable: false; reason: 'not_answered' | 'too_short' } {
  if (args.dialStatus !== 'completed') return { billable: false, reason: 'not_answered' };
  if (args.connectedSeconds < args.minBillableSeconds)
    return { billable: false, reason: 'too_short' };
  return { billable: true, reason: 'completed' };
}

/** Whether the account should take a call at all. A paused/closed/pending account bridges nothing. */
export function canRouteCall(
  a: Pick<PplAccountLike, 'status' | 'balance_cents' | 'cpl_cents'>
): boolean {
  return a.status === 'active' && a.balance_cents >= a.cpl_cents;
}

/** Reload when the balance after a charge falls under the threshold, and only if the owner opted in. */
export function needsReload(
  a: Pick<PplAccountLike, 'auto_reload' | 'reload_threshold_cents'>,
  balanceAfterCents: number
): boolean {
  return a.auto_reload && balanceAfterCents < a.reload_threshold_cents;
}

/** Deterministic idempotency key for a reload: one per (account, triggering charge), never time-bucketed. */
export function reloadIdempotencyKey(accountId: string, triggerLedgerId: string): string {
  return `ppl_reload_${accountId}_${triggerLedgerId}`;
}

export function estimateLeadsRemaining(balanceCents: number, cplCents: number): number {
  return cplCents > 0 ? Math.max(0, Math.floor(balanceCents / cplCents)) : 0;
}

export function disputeWindowOpen(
  chargedAtIso: string,
  nowMs: number,
  hours = PPL_DEFAULTS.disputeWindowHours
): boolean {
  const t = Date.parse(chargedAtIso);
  return Number.isFinite(t) && nowMs - t <= hours * 3_600_000;
}

export const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
