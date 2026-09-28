// lib/outreach/mail/returns.ts
//
// A postcard came back. What that means depends entirely on WHY.
//
// ⚠️ TWO OUTCOMES, ONE OF WHICH IS NOT ABOUT THE POSTCARD AT ALL:
//
//   • wrong address, business fine → fix the address and send again. A mailing problem.
//   • out of business              → stop considering them ANYWHERE. A prospect problem.
//
// Recording only the mailing is the expensive version: the nightly pipeline rebuilds a site for
// a closed business next week, the mailer picks them up again, and the operator marks the next
// returned card the same way, forever. `closeProspect` is what makes the observation stick.
//
// ⚠️ Returns arrive PHYSICALLY — a card in the operator's mailbox. No webhook reports that, and
// Lob's never fired here anyway (all 164 real rows still read `status='created'`). So this is
// deliberately a human-driven path, not an automated one.

import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Why a card came back. Allowlisted because it drives a branch — `out_of_business` closes a
 * prospect, and a free-text reason would let a typo quietly skip that.
 */
export const RETURN_REASONS = [
  /** Address is wrong but the business is alive. Fixable — correct it and resend. */
  'bad_address',
  /** They moved and the card was not forwarded. Fixable if the new address is findable. */
  'moved',
  /** Address exists, nobody there. Usually means gone, but the operator has not confirmed it. */
  'vacant',
  /** Refused delivery. They exist and do not want mail — do NOT resend. */
  'refused',
  /** Confirmed gone. Closes the prospect everywhere. */
  'out_of_business',
  /** Came back with no usable marking. */
  'unknown',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export function isReturnReason(v: unknown): v is ReturnReason {
  return typeof v === 'string' && (RETURN_REASONS as readonly string[]).includes(v);
}

/**
 * Reasons that end the relationship rather than merely this card.
 *
 * ⚠️ `refused` is here and it is NOT a mistake: they exist, they said no. Resending is worse
 * than pointless — it is mail someone has actively declined. It closes the prospect for a
 * different reason than `out_of_business`, which is why `closed_reason` keeps the distinction.
 */
const TERMINAL: ReadonlySet<string> = new Set<ReturnReason>(['out_of_business', 'refused']);

/** Reasons where a corrected address is worth trying. `vacant` is deliberately NOT one. */
const RESENDABLE: ReadonlySet<string> = new Set<ReturnReason>(['bad_address', 'moved']);

export function isTerminal(reason: ReturnReason): boolean {
  return TERMINAL.has(reason);
}
export function isResendable(reason: ReturnReason): boolean {
  return RESENDABLE.has(reason);
}

export type MarkReturnedResult = {
  ok: boolean;
  /** True when the prospect was closed as a consequence — the part that stops future spend. */
  prospectClosed: boolean;
  /** True when a corrected address could make this worth mailing again. */
  resendable: boolean;
  error?: string;
};

/**
 * Record that a card came back, and follow the consequence.
 *
 * Idempotent: marking the same card twice is a no-op on the second call rather than an error,
 * because the operator is working through a physical stack and will lose their place.
 */
export async function markReturned(opts: {
  mailingId: string;
  reason: ReturnReason;
  actorId?: string | null;
  /** Free text for the operator's own notes. Never drives a branch. */
  note?: string | null;
}): Promise<MarkReturnedResult> {
  const { mailingId, reason } = opts;
  if (!isReturnReason(reason)) {
    return { ok: false, prospectClosed: false, resendable: false, error: 'unknown reason' };
  }

  const { data: mailing, error: readErr } = await supabaseAdmin
    .from('postcard_mailings')
    .select('id, prospect_id, returned_at')
    .eq('id', mailingId)
    .maybeSingle();
  if (readErr || !mailing) {
    return { ok: false, prospectClosed: false, resendable: false, error: 'mailing not found' };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabaseAdmin
    .from('postcard_mailings')
    .update({
      // Keep the FIRST returned_at — the card came back once; re-marking corrects the reason,
      // not the date.
      returned_at: (mailing as any).returned_at ?? now,
      return_reason: reason,
      returned_by: opts.actorId ?? null,
      status: 'returned',
      updated_at: now,
    })
    .eq('id', mailingId);
  if (upErr) return { ok: false, prospectClosed: false, resendable: false, error: upErr.message };

  let prospectClosed = false;
  const prospectId = (mailing as any).prospect_id as string | null;
  if (prospectId && isTerminal(reason)) {
    prospectClosed = await closeProspect(prospectId, reason, opts.note ?? null);
  }

  return { ok: true, prospectClosed, resendable: isResendable(reason) };
}

/**
 * Mark a business as gone. The terminal state every selection gate must respect.
 *
 * ⚠️ Does NOT touch `status`. That column records how far they got (discovered → draft_built →
 * claimed) and a business can close at any point in it; overloading it would lose the history
 * and silently change the meaning of every existing `.eq('status', …)` filter.
 */
export async function closeProspect(
  prospectId: string,
  reason: string,
  note?: string | null,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({
      closed_at: new Date().toISOString(),
      closed_reason: note ? `${reason}: ${note}` : reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId)
    .is('closed_at', null); // first close wins; a second marking does not move the date
  return !error;
}

/** Undo a close — the operator found them alive at a new address. */
export async function reopenProspect(prospectId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ closed_at: null, closed_reason: null, updated_at: new Date().toISOString() })
    .eq('id', prospectId);
  return !error;
}

/**
 * Queue a returned card to go out again at a corrected address.
 *
 * ⚠️ Clearing `postcard_sent_at` is what actually re-arms the mailer — `selectMailableDrafts`
 * filters on `.is('postcard_sent_at', null)`. Updating the address alone would change the record
 * and mail nothing, which is the failure this whole file is about: a write that reports success
 * and does not reach the thing that acts on it.
 */
export async function requeueWithAddress(opts: {
  prospectId: string;
  address: string;
  actorId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const address = opts.address.trim();
  if (address.length < 8) return { ok: false, error: 'address looks too short to be real' };

  const { error } = await supabaseAdmin
    .from('outreach_prospects')
    .update({
      address,
      postcard_sent_at: null,
      // A corrected address means they are not gone after all.
      closed_at: null,
      closed_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.prospectId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
