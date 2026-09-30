// app/api/twilio/geo/[campaignId]/voicemail/route.ts
//
// The caller left a message for a business that did not pick up. Store it, and text the
// business the callback number plus a link that actually plays.
//
// ⚠️ IDEMPOTENT ON `voicemail_notified_at`. Twilio retries a webhook it does not get a clean
// answer from, and this one sends an SMS to a real business — a retry storm here is us texting
// a stranger repeatedly about the same call. The column is the guard, not a hope that retries
// will not happen.
//
// ⚠️ The SMS failing must NOT fail the request. A non-2xx sends Twilio round again, which is
// the retry storm; and the recording is already saved, so the operator can still see the lead
// on /admin/call-logs. A failed text is a degraded outcome, not a reason to repeat the call.
import { createClient } from '@supabase/supabase-js';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml } from '@/lib/twilio/verifyWebhook';
import { voicemailThanksTwiml, missedCallSmsText, voicemailUrl } from '@/lib/ppl/voicemail';
import { sendSms } from '@/lib/sms/sendSms';
import { getSenderProfile } from '@/lib/outreach/senderProfile';
import { isOptedOut } from '@/lib/ppl/forwardNotice';

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

  const callSid = v.params.CallSid;
  const recordingUrl = v.params.RecordingUrl || null;
  const from = v.params.From || null;
  if (!callSid) return xmlResponse(voicemailThanksTwiml());

  // Claim the notification before sending, so a concurrent retry loses the race rather than
  // sending a second text.
  const { data: claimed } = await admin
    .from('call_logs')
    .update({
      recording_url: recordingUrl,
      voicemail_notified_at: new Date().toISOString(),
    })
    .eq('call_sid', callSid)
    .is('voicemail_notified_at', null)
    .select('call_sid, from_number, custom_domain');

  // Already notified (a retry) — say thanks and stop. Not an error.
  if (!claimed?.length) return xmlResponse(voicemailThanksTwiml());

  const campaign = await getGeoCampaign(campaignId).catch(() => null);
  const to = campaign?.forward_to ?? null;
  if (to && !(await isOptedOut(to).catch(() => false))) {
    const sender = await getSenderProfile().catch(() => null);
    const text = missedCallSmsText({
      domain: campaign?.domain ?? 'your QuickSites site',
      callerPhone: claimed[0]?.from_number ?? from,
      link: voicemailUrl(callSid, publicBaseUrl()),
      senderName: sender?.name ?? null,
      hasRecording: !!recordingUrl,
    });
    await sendSms(to, text).catch(() => ({ ok: false }));
  }

  return xmlResponse(voicemailThanksTwiml());
}
