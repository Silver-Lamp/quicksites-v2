// lib/analytics/guestFunnel.ts
//
// THE PRE-SUBMIT HALF OF THE GUEST FUNNEL — the half nobody could see.
//
// ⚠️ WHY THIS EXISTS, measured against the live DB on 2026-09-25: 52 guest sites, 21 builders,
// **0 conversions ever**. Of those 21 anonymous owners, `email` = 0, `email_change` = 0,
// `encrypted_password` = 0 — so **not one person has ever submitted the sign-up form.** Two of the
// eight builders since the 2026-09-13 fix spent 95 and 45 minutes editing and still never tried.
//
// ⚠️ THE CONFIRM SIDE WAS ALREADY INSTRUMENTED AND IS NOT THE GAP. `captureGuestConversionIfFresh`
// fires GUEST_SIGNUP_CONFIRMED on BOTH auth branches (the PKCE callback and the fragment
// set-session). It has never fired because nobody has confirmed — which is a correct silence, not
// a broken one. Everything BEFORE that was dark:
//
//   • `guest_upgrade_events` had 0 rows and could not have had any: its only writer,
//     `components/admin/modals/upgrade-modal.tsx`, was imported NOWHERE. A table with a schema, an
//     admin reader and a dead writer looks exactly like instrumentation.
//   • The UI that actually shipped (`guest-publish-banner`, `guest-signup-box`) emitted nothing.
//
// So "0 of 8 converted" was uninterpretable: indistinguishable from "they never saw the button".
// ⚠️ An empty events table means "it did not happen" OR "nobody logged it", and until you know
// which, the next fix is a blind shot. That is the whole reason this file precedes any further
// change to the sign-up UI.
//
// ⚠️ NO PII, BY CONSTRUCTION. The unit is a STEP, never a person. We never send the email address,
// the password, or a provider error string (Supabase puts the address in some of them). Failures
// are one of three coarse reasons. `guest_upgrade_events` has no email column and must not grow
// one.

/** The steps between "building as a guest" and "submitted the form". Allowlisted server-side. */
export const GUEST_FUNNEL_EVENTS = [
  /** The guest banner rendered in the editor — they could see a way to sign up. */
  'prompt_shown',
  /** They asked for the form: the banner link/button, the toolbar, or a refused Publish. */
  'signup_opened',
  /** They put in an email + password and pressed the button. */
  'signup_submitted',
  /** Supabase accepted it and the confirmation email is on its way. */
  'signup_email_sent',
  /** It did not go through. See GuestFunnelReason — coarse, never the provider's message. */
  'signup_failed',
  /** The email was already registered, so we offered "log in instead". */
  'signup_existing_account',
] as const;

export type GuestFunnelEvent = (typeof GUEST_FUNNEL_EVENTS)[number];

/**
 * Where the request for the form came from. `publish` is the interesting one: it means they tried
 * to publish and were refused, which is a far stronger intent signal than clicking a banner.
 */
export const GUEST_FUNNEL_SURFACES = ['banner', 'banner_inline', 'toolbar', 'publish', 'modal'] as const;
export type GuestFunnelSurface = (typeof GUEST_FUNNEL_SURFACES)[number];

/**
 * ⚠️ Coarse on purpose. `weak_password` and `email_exists` are our own classifications; everything
 * else is `error`. Forwarding the provider's message would put the address into an analytics row.
 */
export const GUEST_FUNNEL_REASONS = ['weak_password', 'email_exists', 'error'] as const;
export type GuestFunnelReason = (typeof GUEST_FUNNEL_REASONS)[number];

export function isGuestFunnelEvent(v: unknown): v is GuestFunnelEvent {
  return typeof v === 'string' && (GUEST_FUNNEL_EVENTS as readonly string[]).includes(v);
}

/**
 * The `reason` on GUEST_SIGNUP_EVENT is free-form (any caller may dispatch it), so it is checked
 * against the allowlist before being recorded — an unknown one falls back to `modal` rather than
 * being written through and rejected by the route's schema, which would drop the row entirely.
 */
export function isGuestFunnelSurface(v: unknown): v is GuestFunnelSurface {
  return typeof v === 'string' && (GUEST_FUNNEL_SURFACES as readonly string[]).includes(v);
}

/** The `trigger_reason` column, as one short token: the surface, plus a failure reason if any. */
export function triggerReason(
  surface?: GuestFunnelSurface | null,
  reason?: GuestFunnelReason | null,
): string | null {
  const parts = [surface, reason].filter(Boolean);
  return parts.length ? parts.join(':') : null;
}

export const GUEST_FUNNEL_ENDPOINT = '/api/guest/funnel';

/**
 * Client → server, best-effort and never awaited by the UI.
 *
 * ⚠️ `keepalive` matters: `signup_submitted` fires immediately before a navigation in some flows,
 * and an ordinary fetch is cancelled when the page goes away — which would lose exactly the event
 * that tells us someone tried. Any throw is swallowed: instrumentation must never be able to break
 * the sign-up it is measuring, which is the failure mode that would make this change worse than no
 * change at all.
 */
export function trackGuestFunnel(
  event: GuestFunnelEvent,
  opts: { surface?: GuestFunnelSurface; reason?: GuestFunnelReason } = {},
): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch(GUEST_FUNNEL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({
        event,
        surface: opts.surface ?? null,
        reason: opts.reason ?? null,
        pageUrl: window.location.pathname, // path only — no query string, which can carry tokens
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  } catch {
    /* never let a beacon break the form */
  }
}
