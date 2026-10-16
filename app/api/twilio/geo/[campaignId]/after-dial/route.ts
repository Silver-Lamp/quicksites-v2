// app/api/twilio/geo/[campaignId]/after-dial/route.ts
//
// THE `<Dial action>` FOR A GEO CAMPAIGN'S FORWARD. It decides what happens to the CALLER when
// the forward is over — which, before this existed, was "hang up on them."
//
// The dial used to hand off to `/api/twilio-callback`, a route shared with status and recording
// callbacks, whose answer to everything is an empty `<Response/>`. An empty Response tells
// Twilio to disconnect. So a caller heard "please hold while we connect you", then ringing, then
// silence — confirmed live 2026-09-30, and the way two real leads were lost that morning.
//
// ⚠️ IT DOES ITS OWN call_logs WRITE. Moving the action URL here took the dial leg out of
// `/api/twilio-callback`'s path, so the status and duration it used to record have to be
// recorded here or they vanish — and they are the only evidence of whether a forward works.
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { createClient } from '@supabase/supabase-js';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml, HANGUP_TWIML } from '@/lib/twilio/verifyWebhook';
import { classifyDial } from '@/lib/ppl/forwardHealth';
import { voicemailPromptTwiml } from '@/lib/ppl/voicemail';
import { after } from 'next/server';
import { connectedCallDecision, connectedCallSmsText, type ConnectedCallRow } from '@/lib/ppl/connectedCallNotice';
import { isOptedOut } from '@/lib/ppl/forwardNotice';
import { sendSms } from '@/lib/sms/sendSms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

export async function POST(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const v = await verifyTwilioWebhook(req);
  if (!v.ok) return rejectedTwiml();

  const status = v.params.DialCallStatus ? `dial-${v.params.DialCallStatus}` : null;
  const durationRaw = v.params.DialCallDuration;
  const duration = durationRaw ? parseInt(durationRaw, 10) : null;
  const callSid = v.params.CallSid;

  if (callSid) {
    const row: Record<string, unknown> = { call_sid: callSid };
    if (status) row.call_status = status;
    if (duration !== null && !Number.isNaN(duration)) row.call_duration = duration;
    // onConflict is load-bearing — see the note in /api/twilio-callback. Without it a fresh row
    // never matches and the unique index turns every update into a 23505.
    await admin.from('call_logs').upsert(row, { onConflict: 'call_sid' }).then(
      () => undefined,
      () => undefined,
    );
  }

  const outcome = classifyDial(status, duration);

  // ⚠️ THE BUSINESS IS TEXTED THE CALLER'S NUMBER AFTER EVERY CALL IT TOOK (owner, 2026-10-16:
  // "text them the number as well"). The whisper says it once while they pick up; their phone
  // log then shows OUR tracking number, and V'Z Towing rang their own line back four times looking
  // for the customer they had just spoken to. Runs after the TwiML is out; never delays the caller.
  if (callSid) after(() => notifyConnectedCall(callSid, campaignId));

  // A real conversation happened — the call is genuinely over, so ending it is correct here.
  if (outcome === 'connected') return xmlResponse(HANGUP_TWIML);

  // ⚠️ `brief` goes to voicemail TOO, and that is the Prime Towing case. Twilio reported
  // `dial-completed` after 3 seconds while the caller got three SIT beeps and a disconnect.
  // Treating `completed` as "they were served" is precisely the flattering reading this repo
  // keeps getting caught by. If a caller really did have a short exchange, they hang up; the
  // cost of offering is a few wasted seconds, and the cost of not offering is a lost lead.
  const base = publicBaseUrl();
  const campaign = await getGeoCampaign(campaignId).catch(() => null);
  if (!campaign?.forward_to) return xmlResponse(HANGUP_TWIML);

  return xmlResponse(
    voicemailPromptTwiml({
      recordActionUrl: `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/voicemail`,
    }),
  );
}

async function notifyConnectedCall(callSid: string, campaignId: string): Promise<void> {
  try {
    const { data } = await admin
      .from('call_logs')
      .select('handling, call_status, call_duration, forwarded_to, from_number, connected_notified_at, custom_domain, created_at')
      .eq('call_sid', callSid)
      .maybeSingle();
    const row = (data ?? null) as (ConnectedCallRow & { custom_domain: string | null; created_at: string | null }) | null;
    const decision = connectedCallDecision(row);
    if (!decision.send) return;

    // Claim before sending — a concurrent retry loses the race rather than texting twice.
    const { data: claimed } = await admin
      .from('call_logs')
      .update({ connected_notified_at: new Date().toISOString() })
      .eq('call_sid', callSid)
      .is('connected_notified_at', null)
      .select('call_sid');
    if (!claimed?.length) return;

    let result: Record<string, boolean | string>;
    if (await isOptedOut(decision.to).catch(() => false)) {
      result = { business_sms: false, skipped: 'opted_out' };
    } else {
      const campaign = await getGeoCampaign(campaignId).catch(() => null);
      const r = await sendSms(
        decision.to,
        connectedCallSmsText({
          domain: campaign?.domain ?? row?.custom_domain ?? 'your QuickSites site',
          callerPhone: row!.from_number!,
          durationSeconds: row?.call_duration ?? null,
          at: row?.created_at ?? new Date(),
        }),
      ).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      result = r.ok ? { business_sms: true } : { business_sms: false, error: String((r as { error?: string }).error ?? 'send_failed') };
    }
    await admin
      .from('call_logs')
      .update({ connected_notify_result: result })
      .eq('call_sid', callSid)
      .then(() => undefined, () => undefined);
  } catch {
    /* never throw — the response has already gone out */
  }
}
