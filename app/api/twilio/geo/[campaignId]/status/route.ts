// app/api/twilio/geo/[campaignId]/status/route.ts
//
// The tracking number's PARENT-CALL status callback: Twilio POSTs here when the inbound call
// ends, whatever ended it.
//
// ⚠️ WHY THIS EXISTS. `/after-dial` fires only when a <Dial> finishes. A caller who hangs up
// during the announcement or while the business's phone rings never reaches a Dial outcome, so
// the row written at ring time stayed `ringing` forever — indistinguishable from a live call.
// On 2026-10-05 a five-second robocall to renton-electrical.com sat at `ringing` for an hour
// and the alert email said "still in progress". Twilio knew it was over at 11:18:34.
//
// The decision of what to write is `lib/ppl/parentCallEnd.ts#parentEndWrite` (pure, tested);
// this route only verifies the signature and applies it.
//
// ⚠️ IT ALSO TEXTS THE BUSINESS ABOUT A FORWARD THAT RANG OUT WITH NO MESSAGE (2026-10-07).
// The decision is `lib/ppl/missedCallNotice.ts#missedCallDecision` (pure). It runs in `after()`
// — Twilio's response goes out first — and only after a short settle, so the voicemail
// webhook's claim can land before we conclude "no message". One text per call, claimed on
// `missed_call_notified_at` before the send, because Twilio retries a callback it does not get a
// clean answer from and this one texts a real business.
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml, HANGUP_TWIML } from '@/lib/twilio/verifyWebhook';
import { parentEndWrite } from '@/lib/ppl/parentCallEnd';
import { missedCallDecision, MISSED_CALL_SETTLE_MS, type MissedCallRow } from '@/lib/ppl/missedCallNotice';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { isOptedOut } from '@/lib/ppl/forwardNotice';
import { missedCallSmsText } from '@/lib/ppl/voicemail';
import { sendSms } from '@/lib/sms/sendSms';
import { getSenderProfile } from '@/lib/outreach/senderProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
  const status = (v.params.CallStatus || '').trim().toLowerCase();
  const durRaw = v.params.CallDuration;
  const parsed = durRaw ? parseInt(durRaw, 10) : NaN;
  const durationSec = Number.isNaN(parsed) ? null : parsed;
  if (callSid && status) {
    const { data: row } = await admin
      .from('call_logs')
      .select('call_status, handling')
      .eq('call_sid', callSid)
      .maybeSingle();
    const write = parentEndWrite(row ?? null, { status, durationSec });
    if (write) {
      await admin.from('call_logs').update(write).eq('call_sid', callSid).then(
        () => undefined,
        () => undefined,
      );
    }

    after(() => notifyMissedCall(callSid, campaignId, status));
  }
  // The call is already over; Twilio ignores the body, but TwiML keeps every voice-path response
  // the same shape (see verifyWebhook: a JSON body on a voice URL is a 12100).
  return xmlResponse(HANGUP_TWIML);
}

async function notifyMissedCall(callSid: string, campaignId: string, parentStatus: string): Promise<void> {
  try {
    await new Promise((r) => setTimeout(r, MISSED_CALL_SETTLE_MS));
    // Re-read AFTER the settle: the row may have gained a recording since the request began.
    const { data } = await admin
      .from('call_logs')
      .select('from_number, custom_domain, handling, call_status, call_duration, forwarded_to, recording_url, voicemail_notified_at, missed_call_notified_at')
      .eq('call_sid', callSid)
      .maybeSingle();
    const row = (data ?? null) as (MissedCallRow & { from_number: string | null; custom_domain: string | null }) | null;
    const decision = missedCallDecision(row, { status: parentStatus });
    if (!decision.send) return;

    // Claim before sending — a concurrent retry loses the race rather than texting twice.
    const { data: claimed } = await admin
      .from('call_logs')
      .update({ missed_call_notified_at: new Date().toISOString() })
      .eq('call_sid', callSid)
      .is('missed_call_notified_at', null)
      .select('call_sid');
    if (!claimed?.length) return;

    let result: Record<string, boolean | string>;
    // The destination's own STOP outranks the fact that it was dialled.
    if (await isOptedOut(decision.to).catch(() => false)) {
      result = { business_sms: false, skipped: 'opted_out' };
    } else {
      const campaign = await getGeoCampaign(campaignId).catch(() => null);
      const sender = await getSenderProfile().catch(() => null);
      const r = await sendSms(
        decision.to,
        missedCallSmsText({
          domain: campaign?.domain ?? row?.custom_domain ?? 'your QuickSites site',
          callerPhone: row?.from_number ?? null,
          // No recording exists on this branch by construction (see missedCallDecision), so
          // the text says "didn't leave a message" and carries no link.
          link: '',
          senderName: sender?.name ?? null,
          hasRecording: false,
        }),
      ).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      result = r.ok ? { business_sms: true } : { business_sms: false, error: String((r as { error?: string }).error ?? 'send_failed') };
    }

    await admin
      .from('call_logs')
      .update({ missed_call_notify_result: result })
      .eq('call_sid', callSid)
      .then(() => undefined, () => undefined);
  } catch {
    /* never throw — the response has already gone out; losing the text is bad, a retry storm is worse */
  }
}
