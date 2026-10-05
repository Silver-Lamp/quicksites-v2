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
import { createClient } from '@supabase/supabase-js';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml, HANGUP_TWIML } from '@/lib/twilio/verifyWebhook';
import { parentEndWrite } from '@/lib/ppl/parentCallEnd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

export async function POST(req: Request) {
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
  }
  // The call is already over; Twilio ignores the body, but TwiML keeps every voice-path response
  // the same shape (see verifyWebhook: a JSON body on a voice URL is a 12100).
  return xmlResponse(HANGUP_TWIML);
}
