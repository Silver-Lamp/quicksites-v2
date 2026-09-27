// lib/analytics/guestFunnelServer.ts
//
// The half of the guest funnel the BROWSER must not be trusted to report.
//
// `trackGuestFunnel` is a beacon: anyone can POST it, and for the pre-submit steps that is fine —
// the worst a forged `prompt_shown` does is inflate a denominator. "This site went live" is a
// different kind of claim. It is the last step of the funnel and the one a decision would rest
// on, so it is written here, on the server, at the moment the publish actually succeeds.
//
// ⚠️ NEVER AWAITED BY THE PUBLISH PATH, AND NEVER ABLE TO FAIL IT. Instrumentation that can break
// the thing it measures is worse than no instrumentation: a publish that 500s because an
// analytics insert failed would turn "we cannot see the last step" into "the last step does not
// work". Every call is wrapped and swallowed.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { GuestFunnelServerEvent } from './guestFunnel';

/**
 * Record a server-observed funnel step for a user who arrived as a guest.
 *
 * ⚠️ `guest_user_id` keeps its name even after the account is real, because the guest upgrades
 * IN PLACE — same uid before and after sign-up. That is what makes the funnel joinable end to
 * end; renaming the column would break the join for every row already written.
 */
export async function recordGuestPublishEvent(
  event: GuestFunnelServerEvent,
  userId: string | null | undefined,
  opts: { pageUrl?: string | null; reason?: string | null } = {},
): Promise<void> {
  if (!userId) return;
  try {
    await supabaseAdmin.from('guest_upgrade_events').insert({
      guest_user_id: userId,
      event,
      // ⚠️ A template id, never a URL with a query string — those carry claim tokens.
      page_url: opts.pageUrl ?? null,
      trigger_reason: opts.reason ?? null,
    });
  } catch {
    /* an unrecorded step is a gap in a chart; a thrown one is a broken publish */
  }
}
