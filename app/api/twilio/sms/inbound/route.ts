// app/api/twilio/sms/inbound/route.ts
//
// Inbound SMS to any tracking number. Only one thing matters here: STOP. A forwarded business
// that replies STOP has its forward cleared on every campaign that used its phone and is never
// picked again (docs/PPL_VERTICAL.md §9). START forgets the opt-out (an operator re-attaches).
// Anything else gets no reply — a tracking number is not a conversation.
//
// Twilio-signed like every other Twilio webhook here. Twilio's own opt-out handling also runs
// (it blocks our future SMS to the number); this route is what clears the CALL forward, which
// Twilio knows nothing about.

import { NextResponse, after } from 'next/server';
import twilio from 'twilio';
import {
  applyStart,
  applyStop,
  isStartMessage,
  isStopMessage,
  stopConfirmationText,
} from '@/lib/ppl/forwardNotice';
import { parseOutcomeReply, outcomeReplyAck } from '@/lib/ppl/outcomeSurvey';
import { recordOutcomeReply } from '@/lib/ppl/outcomeSurveyDb';
import { campaignForNumber, recordInboundSms, emailInboundReply } from '@/lib/ppl/inboundSms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function xml(twiml: string) {
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST(req: Request) {
  const text = await req.text();
  const params = Object.fromEntries(new URLSearchParams(text).entries());

  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const signature = req.headers.get('x-twilio-signature') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || '';
  const u = new URL(req.url);
  const url = `${proto}://${host}${u.pathname}${u.search}`;
  if (!authToken || !twilio.validateRequest(authToken, signature, url, params)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 });
  }

  const from = params.From || '';
  const body = params.Body || '';
  const optOutType = params.OptOutType || null;
  const to = params.To || null;
  const sid = params.MessageSid || null;
  if (!from) return xml('<?xml version="1.0" encoding="UTF-8"?><Response/>');

  if (isStopMessage(body, optOutType)) {
    await applyStop(from, 'sms_stop');
    after(async () => { const c = await campaignForNumber(from).catch(() => null); const id = await recordInboundSms({ from, to, body, kind: 'stop', sid, campaign: c }); await emailInboundReply(id, { from, body, kind: 'stop', campaign: c }); });
    // Twilio may have already blocked outbound SMS to this number; the <Message> is best-effort.
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${stopConfirmationText()}</Message></Response>`
    );
  }
  if (isStartMessage(body, optOutType)) {
    await applyStart(from);
    after(async () => { const c = await campaignForNumber(from).catch(() => null); const id = await recordInboundSms({ from, to, body, kind: 'start', sid, campaign: c }); await emailInboundReply(id, { from, body, kind: 'start', campaign: c }); });
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }
  // "Did that call become a job?" (lib/ppl/outcomeSurvey.ts): a Y / N / NOT YET from a business
  // lands on the most recent call we ASKED it about and have no answer for. Anything else is
  // ignored — this line is not a conversation. Best-effort; a failure answers nothing.
  const reply = parseOutcomeReply(body);
  if (reply) {
    const recorded = await recordOutcomeReply(from, reply, body).catch(() => false);
    if (recorded) {
      after(async () => { const c = await campaignForNumber(from).catch(() => null); await recordInboundSms({ from, to, body, kind: 'outcome', sid, campaign: c }); });
      return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${outcomeReplyAck(reply)}</Message></Response>`);
    }
  }
  // Everything else is a human writing to us — a reply to the pitch, a question, "how do I pay".
  // Stored, matched to its campaign, emailed to the owner with the next move. NO auto-reply:
  // the honest answer to a person's words is a person (2026-10-18, the day the first pitch went out).
  after(async () => {
    const c = await campaignForNumber(from).catch(() => null);
    const id = await recordInboundSms({ from, to, body, kind: 'reply', sid, campaign: c });
    await emailInboundReply(id, { from, body, kind: 'reply', campaign: c });
  });
  return xml('<?xml version="1.0" encoding="UTF-8"?><Response/>');
}
