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
//
// ⚠️ ANSWER TWILIO FIRST, THEN LISTEN (2026-10-07). The caller is on the line waiting for "thanks,
// we'll pass it on"; a transcription takes seconds and must not sit in front of that TwiML. The
// claim (idempotency) is synchronous; everything after it — transcribe, decide whether anyone
// spoke, notify — runs in Next's `after()`, which keeps the function alive once the response has
// gone out. Why transcribe at all: a fax machine left 21 s of CNG tone on covingtontow.com and
// the operator email said "New lead … Relay it to a local business". Nobody should be asked to
// relay a fax, and no business should be texted "someone called" about one.
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml } from '@/lib/twilio/verifyWebhook';
import {
  voicemailThanksTwiml,
  missedCallSmsText,
  voicemailUrl,
  notifyOperatorOfVoicemail,
} from '@/lib/ppl/voicemail';
import { transcribeVoicemail, type VoicemailSpeech } from '@/lib/ppl/voicemailSpeech';
import { sendSms } from '@/lib/sms/sendSms';
import { getSenderProfile } from '@/lib/outreach/senderProfile';
import { isOptedOut } from '@/lib/ppl/forwardNotice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  const callerPhone = claimed[0]?.from_number ?? from;

  after(async () => {
    // 1) Did a person speak? Decides the wording of every notification below.
    let speech: VoicemailSpeech = 'unknown';
    let transcript: string | null = null;
    if (recordingUrl) {
      const t = await transcribeVoicemail(recordingUrl, { callSid });
      speech = t.speech;
      transcript = t.transcript;
      await admin
        .from('call_logs')
        .update({ voicemail_speech: speech, voicemail_transcript: transcript, voicemail_transcribed_at: new Date().toISOString() })
        .eq('call_sid', callSid)
        .then(() => undefined, () => undefined);
    }

    const campaign = await getGeoCampaign(campaignId).catch(() => null);
    const to = campaign?.forward_to ?? null;
    const link = voicemailUrl(callSid, publicBaseUrl());

    // ⚠️ WHAT ACTUALLY REACHED SOMEONE, RECORDED. `voicemail_notified_at` is stamped by the
    // CLAIM, before either channel runs, so it only ever says we tried. On the first real
    // voicemail-first call the email arrived and the SMS did not, and because this outcome was
    // discarded the cause had to be reconstructed from Vercel deployment timestamps. A
    // notification that silently did not happen is the same silence this whole feature exists to
    // prevent, one level up. See 20260866.
    let result: Record<string, boolean | string> = { speech };

    if (to && !(await isOptedOut(to).catch(() => false))) {
      if (speech === 'no_speech') {
        // A business must never be texted "someone called, ring them back" about a fax tone.
        result = { ...result, business_sms: false, skipped: 'no_speech' };
      } else {
        const sender = await getSenderProfile().catch(() => null);
        const r = await sendSms(
          to,
          missedCallSmsText({
            domain: campaign?.domain ?? 'your QuickSites site',
            callerPhone,
            link,
            senderName: sender?.name ?? null,
            hasRecording: !!recordingUrl,
          }),
        ).catch(() => ({ ok: false }));
        result = { ...result, business_sms: !!r.ok };
      }
    } else {
      // ⚠️ VOICEMAIL-FIRST: there is no business to text, and a message nobody is told about is a
      // lead dying in a table. The caller was promised we would pass it on, so somebody has to be
      // told — and during the experiment that somebody is the operator, who relays it by hand.
      //
      // ⚠️ THE PROMISE IS MADE TO THE CALLER, SO IT CANNOT WAIT ON A DASHBOARD BEING CHECKED.
      // /admin/call-logs would show the row, but at roughly one call every five days nobody is
      // watching, and "it was visible if you looked" is how the two leads on 2026-09-30 were
      // lost in the first place.
      const r = await notifyOperatorOfVoicemail({
        domain: campaign?.domain ?? 'a QuickSites site',
        callerPhone,
        link,
        hasRecording: !!recordingUrl,
        speech,
        transcript,
      });
      result = { ...result, operator_email: r.email, operator_sms: r.sms };
    }

    // Best-effort: losing the diagnostic is bad; losing the lead is worse.
    await admin
      .from('call_logs')
      .update({ voicemail_notify_result: result })
      .eq('call_sid', callSid)
      .then(() => undefined, () => undefined);
  });

  return xmlResponse(voicemailThanksTwiml());
}
