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

import { NextResponse } from 'next/server';
import twilio from 'twilio';
import {
  applyStart,
  applyStop,
  isStartMessage,
  isStopMessage,
  stopConfirmationText,
} from '@/lib/ppl/forwardNotice';

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
  if (!from) return xml('<?xml version="1.0" encoding="UTF-8"?><Response/>');

  if (isStopMessage(body, optOutType)) {
    await applyStop(from, 'sms_stop');
    // Twilio may have already blocked outbound SMS to this number; the <Message> is best-effort.
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${stopConfirmationText()}</Message></Response>`
    );
  }
  if (isStartMessage(body, optOutType)) {
    await applyStart(from);
    return xml('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }
  return xml('<?xml version="1.0" encoding="UTF-8"?><Response/>');
}
