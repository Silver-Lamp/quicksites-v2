// app/api/twilio/geo/[campaignId]/cascade/route.ts
//
// ONE STEP OF THE CASCADE. Twilio re-enters here after every leg, so this route is the loop
// body: read what has been tried, pick the next business, ring it, or run out and take a
// message.
//
// ⚠️ THE ONLY STATE IS IN THE DATABASE. Each Twilio webhook is an independent HTTP request with
// no memory of the last, so `?attempt=N` plus `cascade_attempts` IS the state machine. Nothing
// may be held in a module variable — a second Vercel instance would not see it, and the caller
// would be rung round in circles.
//
// ⚠️ `?attempt=N` IS WHY `lib/twilio/verifyWebhook.ts` HAD TO EXIST FIRST. Twilio signs the full
// URL including the query string, and the older check built its URL from the pathname alone.
// Against this route that check 403s every request, and a 403 on a voice webhook is a caller
// hearing "an application error has occurred."
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { KEY_TO_LABEL } from '@/lib/industries';
import { verifyTwilioWebhook, xmlResponse, rejectedTwiml } from '@/lib/twilio/verifyWebhook';
import {
  orderCascade,
  nextCascadeStep,
  isAccepted,
  cascadeWhisperTwiml,
  cascadeExhaustedTwiml,
  CASCADE_RING_SECONDS,
} from '@/lib/ppl/cascade';
import { loadCascadePool, loadAttempts, recordAttempt } from '@/lib/ppl/cascadeStore';

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
  const url = new URL(req.url);
  const v = await verifyTwilioWebhook(req);
  if (!v.ok) return rejectedTwiml();

  const callSid = v.params.CallSid;
  const base = publicBaseUrl();
  const recordActionUrl = `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/voicemail`;
  if (!callSid) return xmlResponse(cascadeExhaustedTwiml({ tried: 0, recordActionUrl }));

  const campaign = await getGeoCampaign(campaignId).catch(() => null);
  if (!campaign) return xmlResponse(cascadeExhaustedTwiml({ tried: 0, recordActionUrl }));

  const tried = await loadAttempts(callSid);

  // Somebody already took this call. Reached when Twilio re-enters after a bridged conversation
  // ends; ringing the next business at that point would call a stranger about a solved problem.
  if (isAccepted(tried)) {
    return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }

  const pool = orderCascade(await loadCascadePool(campaignId));
  const step = nextCascadeStep(pool, tried);

  if (step.kind === 'exhausted') {
    return xmlResponse(cascadeExhaustedTwiml({ tried: step.tried, recordActionUrl }));
  }

  // Claim the attempt before ringing. A retry loses the unique index and gets false, which means
  // this step already happened — advancing anyway would silently skip a business.
  const claimed = await recordAttempt({
    callSid,
    campaignId,
    attempt: step.attempt,
    candidate: step.candidate,
  });
  if (!claimed) {
    // Re-enter one step along rather than re-ringing or dropping the caller.
    return xmlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${esc(
        `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/cascade?attempt=${step.attempt + 1}`,
      )}</Redirect></Response>`,
    );
  }

  const trade = (KEY_TO_LABEL as Record<string, string>)[campaign.industry_key ?? ''] ?? 'local';
  const acceptUrl = `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/accept?attempt=${step.attempt}`;
  const afterUrl = `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/cascade-leg?attempt=${step.attempt}`;
  const whisperUrl = `${base}/api/twilio/geo/${encodeURIComponent(campaignId)}/whisper?attempt=${step.attempt}`;

  // ⚠️ The whisper URL carries the accept Gather, so the business must press 1 before the legs
  // bridge. Without it a voicemail "answers", the cascade stops, and a stranded caller is
  // bridged to a greeting — the failure this whole feature exists to fix.
  //
  // ⚠️ callerId is OUR tracking number. Twilio refuses to place a call presenting a number the
  // account does not own (every such leg failed in 0 s on 2026-09-19 with no STIR attestation).
  const callerId = campaign.tracking_number ?? v.params.To ?? '';
  const callerIdAttr = callerId ? ` callerId="${esc(callerId)}"` : '';

  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${CASCADE_RING_SECONDS}" answerOnBridge="true"${callerIdAttr} action="${esc(afterUrl)}" method="POST">
    <Number url="${esc(whisperUrl)}">${esc(step.candidate.phone)}</Number>
  </Dial>
</Response>`,
  );
}

// Twilio <Redirect> issues a POST by default but will GET if told to; accept both so a
// misconfigured verb degrades to a working call rather than a 405 the caller hears as an error.
export const GET = POST;
