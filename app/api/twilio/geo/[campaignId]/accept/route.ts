// app/api/twilio/geo/[campaignId]/accept/route.ts
//
// The business pressed a key. This is the ONLY place `cascade_attempts.accepted` becomes true.
//
// ⚠️ ACCEPTANCE IS RECORDED HERE AND INFERRED NOWHERE. A rejected whisper and a short real
// conversation both reach us from Twilio as `completed` with a small duration, so no downstream
// handler can tell them apart — reading `completed` as "a person took this call" is the mistake
// that produced this entire feature. A keypress is the one signal a voicemail cannot produce.
//
// ⚠️ Only `1` accepts. Anything else hangs up the business's leg, and the cascade moves on
// rather than bridging a caller to someone who did not agree to take them.
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml } from '@/lib/twilio/verifyWebhook';
import { recordAcceptance } from '@/lib/ppl/cascadeStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  await ctx.params;
  const attempt = parseInt(new URL(req.url).searchParams.get('attempt') ?? '0', 10);
  const v = await verifyTwilioWebhook(req);
  if (!v.ok) return rejectedTwiml();

  const digits = (v.params.Digits ?? '').trim();
  const callSid = v.params.CallSid;

  if (digits !== '1') {
    // Declined or mis-keyed. Ending this leg returns control to the <Dial action>, which
    // advances the cascade. Saying nothing would leave them holding a dead line.
    return xmlResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">No problem. Goodbye.</Say><Hangup/></Response>',
    );
  }

  if (callSid && Number.isFinite(attempt) && attempt > 0) {
    await recordAcceptance(callSid, attempt).catch(() => undefined);
  }

  // Returning without a <Hangup> lets this leg bridge to the waiting caller — the TwiML ends,
  // and Twilio joins the two. A <Hangup/> here would drop the customer at the moment somebody
  // finally agreed to take them.
  return xmlResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Connecting you now.</Say></Response>',
  );
}

export const GET = POST;
