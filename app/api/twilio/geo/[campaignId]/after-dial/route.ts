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

  // A real conversation happened — the call is genuinely over, so ending it is correct here.
  if (outcome === 'answered') return xmlResponse(HANGUP_TWIML);

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
