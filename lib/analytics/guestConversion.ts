// lib/analytics/guestConversion.ts
//
// The one funnel event the guest→signup fix is measured by: GUEST_SIGNUP_CONFIRMED, fired the
// first time a formerly-anonymous builder lands with a confirmed email.
//
// Why SIGNUP cannot carry it: captureSignupIfNew keys on account age (created seconds ago), and a
// guest's account was created when they started building — minutes, hours or days before they
// confirmed. So a converted guest looked like a returning login and was never counted.
//
// Two checks, cheap then definitive: the confirmation is fresh AND the account predates it
// (pure, no I/O); then the user owns a guest-built template (one query). Best-effort — never
// blocks the session write.
import { captureServer } from './posthog-server';
import { EVENTS } from './events';

export type ConfirmedUserShape = {
  id: string;
  email?: string | null;
  is_anonymous?: boolean | null;
  created_at?: string | null;
  email_confirmed_at?: string | null;
};

/** How recently the email must have been confirmed to count as "this landing is the conversion". */
export const CONFIRMATION_FRESHNESS_MS = 2 * 60 * 1000;
/** The account must be older than the confirmation by at least this much to have been a guest. */
export const MIN_GUEST_AGE_BEFORE_CONFIRM_MS = 60 * 1000;

const ms = (s?: string | null) => (s ? new Date(s).getTime() || 0 : 0);

/** Pure: does this landing look like a guest who just confirmed? (Ownership is checked separately.) */
export function isFreshGuestConfirmation(user: ConfirmedUserShape | null | undefined, now = Date.now()): boolean {
  if (!user?.id || !user.email || user.is_anonymous) return false;
  const confirmed = ms(user.email_confirmed_at);
  const created = ms(user.created_at);
  if (!confirmed || !created) return false;
  if (now - confirmed > CONFIRMATION_FRESHNESS_MS) return false; // a later login, not the conversion
  return confirmed - created >= MIN_GUEST_AGE_BEFORE_CONFIRM_MS; // a fresh email signup confirms seconds after creation
}

/**
 * Emit GUEST_SIGNUP_CONFIRMED once, best-effort. `ownsGuestSite` is injectable so the pure part
 * is testable; the default asks the DB whether this user owns a claim_source='guest_build' row.
 */
export async function captureGuestConversionIfFresh(
  user: ConfirmedUserShape | null | undefined,
  ownsGuestSite: (userId: string) => Promise<boolean> = defaultOwnsGuestSite,
  now = Date.now(),
): Promise<boolean> {
  if (!isFreshGuestConfirmation(user, now)) return false;
  if (!(await ownsGuestSite(user!.id))) return false;
  await captureServer(EVENTS.GUEST_SIGNUP_CONFIRMED, { user_id: user!.id }, user!.id);
  return true;
}

async function defaultOwnsGuestSite(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { count } = await supabaseAdmin
    .from('templates')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('claim_source', 'guest_build');
  return (count ?? 0) > 0;
}
