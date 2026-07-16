// lib/menu/demandNotify.ts
//
// Phase 2 conversion trigger: when order-intent on an unclaimed delivered.menu draft
// crosses the threshold, text the restaurant ONCE — "N people tried to order from the
// free site we built you; claim it to turn on online ordering: <link>". This is the
// moment the demand signal becomes a claim pitch.
//
// Deliberately conservative:
//   • no customer PII in the message — a visitor left their number expecting *us* to
//     signal demand, not to hand their number to the business. The captured leads become
//     the owner's only after they claim (they then own that site's data).
//   • sent at most once per draft (deduped on demand_events.notified_at).
//   • server-derived phone only (resolveListingPhone), never claimer/visitor-supplied.
//   • an opt-out line, like the rest of our outreach SMS. Cold B2B SMS is regulated
//     (TCPA / A2P 10DLC) — registration/consent is the operator's responsibility; this
//     whole path is gated OFF behind MENU_DEMAND_CAPTURE_SMS.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendSms } from '@/lib/sms/sendSms';
import { resolveListingPhone } from '@/lib/claim/resolveListingPhone';
import { claimUrlFor } from '@/lib/outreach/competitionPoster';
import { getSenderProfile } from '@/lib/outreach/senderProfile';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { MENU_DEMAND_CAPTURE_SMS, menuDemandNotifyThreshold } from '@/lib/flags/menuDemand';

export type DemandNotifyResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'not_claimable' | 'below_threshold' | 'already_notified' | 'no_phone' | 'send_failed' };

function composeMessage(businessName: string | null, count: number, url: string, sender: { name: string | null; email: string | null }): string {
  const who = businessName?.trim() || 'your restaurant';
  const n = count === 1 ? '1 person' : `${count} people`;
  const signParts = [sender.name?.trim(), sender.email?.trim()].filter(Boolean) as string[];
  const signOff = signParts.length ? `\n— ${signParts.join(' · ')}` : '';
  return (
    `Hi — ${n} tried to order online from ${who} through the free website we built for you. ` +
    `Claim it (2 min, free) to turn on online ordering and start collecting: ${url}` +
    `${signOff}\n\nReply STOP to opt out.`
  );
}

/**
 * Fire the one-time restaurant notification if this draft just crossed the threshold.
 * Best-effort and idempotent — safe to call after every demand event; returns a reason
 * when it no-ops. Never throws (callers run it fire-and-forget after logging demand).
 */
export async function maybeNotifyRestaurant(templateId: string): Promise<DemandNotifyResult> {
  try {
    if (!MENU_DEMAND_CAPTURE_SMS) return { sent: false, reason: 'disabled' };

    const { data: tpl } = await supabaseAdmin
      .from('templates')
      .select('id, claim_source, business_name, template_name, data')
      .eq('id', templateId)
      .maybeSingle();
    const row = tpl as { claim_source?: string | null; business_name?: string | null; template_name?: string | null; data?: any } | null;
    if (!row || row.claim_source !== 'listing_import') return { sent: false, reason: 'not_claimable' };

    // Already pinged this draft? Notify once — a second text would read as spam.
    const { data: prior } = await supabaseAdmin
      .from('demand_events')
      .select('id')
      .eq('template_id', templateId)
      .not('notified_at', 'is', null)
      .limit(1);
    if (Array.isArray(prior) && prior.length) return { sent: false, reason: 'already_notified' };

    const { count } = await supabaseAdmin
      .from('demand_events')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', templateId);
    const total = count ?? 0;
    if (total < menuDemandNotifyThreshold()) return { sent: false, reason: 'below_threshold' };

    const phone = resolveListingPhone({ data: row.data });
    if (!phone) return { sent: false, reason: 'no_phone' };

    const sender = await getSenderProfile();
    const url = claimUrlFor(templateId);
    const body = composeMessage(row.business_name ?? row.template_name ?? null, total, url, sender);

    const res = await sendSms(phone, body);
    if (!res.ok) return { sent: false, reason: 'send_failed' };

    // Stamp the whole draft's events as notified — the dedup guard for next time.
    await supabaseAdmin
      .from('demand_events')
      .update({ notified_at: new Date().toISOString() })
      .eq('template_id', templateId)
      .is('notified_at', null);

    await captureServer(EVENTS.MENU_DEMAND_NOTIFIED, { template_id: templateId, count: total }, templateId);
    return { sent: true };
  } catch {
    return { sent: false, reason: 'send_failed' };
  }
}
