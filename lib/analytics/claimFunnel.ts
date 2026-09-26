// lib/analytics/claimFunnel.ts
//
// THE OTHER HALF OF THE SAME WALL.
//
// ⚠️ Measured 2026-09-25: 176 postcards mailed → **4 people scanned** → **0 claims**. Those four are
// the only strangers who have responded to anything this product has ever sent. Osborne's Towing
// scanned three times. And between their scan and giving up, we recorded nothing at all: `/go/<id>`
// counts the scan, and the next observable event would have been ownership changing hands, which
// has never happened. Everything in between was dark.
//
// ⚠️ The claim path ends where the guest path ends. `/api/claim-draft/<id>` drops a cookie and
// redirects to SIGN-UP; the transfer happens post-login in `claimPendingSiteDraft`. So a towing
// operator holding a postcard is asked to create an account before they can have the site that is
// already about their own business. Guest build converts 0 of 21 at that same step. These events
// exist to show which side of it people stop on — and in particular to separate "saw the page and
// walked away" from "the page refused them", which are opposite problems.
//
// ⚠️ WRITTEN TO THE DATABASE, NOT POSTHOG — the decision this file most needs to survive.
// `captureServer` is the obvious home and would have looked complete. But PostHog has never been
// configured in production, so all 33 existing call sites no-op; instrumenting this funnel there
// would have produced a third measurement that cannot record. We mirror to PostHog as well, so the
// events are there the day a key is set, but the table is the source of truth.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { captureServer } from './posthog-server';

export const CLAIM_FUNNEL_EVENTS = [
  /** The claim page rendered with a live token and a claimable draft — they saw the offer. */
  'claim_page_viewed',
  /** The page refused them. `reason` says why; this is a dead end a person hit, not a non-event. */
  'claim_page_dead_end',
  /** They pressed the button. From here they are handed to sign-up. */
  'claim_started',
  /** Ownership actually transferred, post-login. The only step that means anything commercially. */
  'claim_completed',
] as const;

export type ClaimFunnelEvent = (typeof CLAIM_FUNNEL_EVENTS)[number];

/**
 * Why a step ended as it did. Coarse by design and never a provider message.
 *
 * ⚠️ `bad_token` and `not_claimable` look similar and are completely different failures:
 * a bad/expired token means OUR LINK is broken for someone who tried, while not-claimable means the
 * draft is genuinely gone. Collapsing them would hide a broken postcard behind a legitimate refusal.
 */
export type ClaimFunnelReason = 'bad_token' | 'not_claimable' | 'already_claimed' | 'error';

/**
 * Record one step. Best-effort and never throws: this runs inside page renders and the claim
 * redirect, and a failed write must never cost somebody the site they are trying to claim.
 * ⚠️ A failure is logged rather than swallowed — an insert that fails quietly is the bug this
 * whole file exists to end.
 */
export async function recordClaimStep(
  event: ClaimFunnelEvent,
  input: { templateId: string; prospectId?: string | null; reason?: ClaimFunnelReason | null },
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any).from('claim_funnel_events').insert({
      template_id: input.templateId,
      prospect_id: input.prospectId ?? null,
      event,
      reason: input.reason ?? null,
    });
    if (error) console.error('[claim-funnel] insert failed', { event, message: error.message });
  } catch (e: any) {
    console.error('[claim-funnel] insert threw', { event, message: e?.message });
  }
  // Mirror, for whenever POSTHOG_KEY exists. distinctId is the DRAFT, never a person — we do not
  // know who is holding the postcard and must not invent an identity for them.
  try {
    await captureServer(
      `claim_${event.replace(/^claim_/, '')}`,
      { template_id: input.templateId, prospect_id: input.prospectId ?? null, reason: input.reason ?? null },
      `claim:${input.templateId}`,
    );
  } catch {
    /* advisory */
  }
}
