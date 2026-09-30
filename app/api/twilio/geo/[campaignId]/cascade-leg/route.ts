// app/api/twilio/geo/[campaignId]/cascade-leg/route.ts
//
// One cascade leg finished. Record how it went, then either stop (someone took the call) or
// send the caller back round for the next business.
//
// ⚠️ IT DECIDES "DID SOMEONE TAKE THIS CALL" FROM `cascade_attempts.accepted`, NEVER FROM
// `DialCallStatus`. Twilio reports `completed` for a voicemail pickup, for a business that
// pressed 1 and talked for ten minutes, and for one that heard the whisper and hung up. Only
// the accept webhook, fired by a keypress, can tell them apart — and getting this wrong is how
// a stranded caller ends up listening to an answering machine while the cascade congratulates
// itself.
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml } from '@/lib/twilio/verifyWebhook';
import { recordAttemptOutcome, loadAttempts } from '@/lib/ppl/cascadeStore';
import { isAccepted } from '@/lib/ppl/cascade';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const attempt = parseInt(new URL(req.url).searchParams.get('attempt') ?? '0', 10);
  const v = await verifyTwilioWebhook(req);
  if (!v.ok) return rejectedTwiml();

  const callSid = v.params.CallSid;
  const status = v.params.DialCallStatus ? `dial-${v.params.DialCallStatus}` : null;
  const durationRaw = v.params.DialCallDuration;
  const duration = durationRaw ? parseInt(durationRaw, 10) : null;

  if (callSid && Number.isFinite(attempt) && attempt > 0) {
    await recordAttemptOutcome(callSid, attempt, {
      dialStatus: status,
      durationSec: duration !== null && !Number.isNaN(duration) ? duration : null,
    }).catch(() => undefined);
  }

  const tried = callSid ? await loadAttempts(callSid) : [];
  if (isAccepted(tried)) {
    // A business took it and the conversation has now ended. The call is genuinely over.
    return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }

  // Nobody took it. Back into the loop — the cascade route decides whether anyone is left.
  const base = publicBaseUrl();
  const next = `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/cascade?attempt=${attempt + 1}`;
  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Still looking. Trying another.</Say>
  <Redirect method="POST">${esc(next)}</Redirect>
</Response>`,
  );
}

export const GET = POST;
