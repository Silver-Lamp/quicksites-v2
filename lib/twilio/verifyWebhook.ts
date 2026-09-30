// lib/twilio/verifyWebhook.ts
//
// One Twilio webhook signature check, done over the FULL URL.
//
// ⚠️ THE QUERY STRING IS PART OF WHAT TWILIO SIGNS, AND THE EXISTING CHECK DROPPED IT.
// `app/api/twilio-callback/route.ts` builds its URL from `new URL(req.url).pathname`, with no
// `search`. That has been harmless only because nothing ever put a parameter on that URL — the
// moment one appears, every request 403s, and a 403 on a voice webhook is not a quiet failure:
// Twilio plays "an application error has occurred" to a caller. The cascade needs `?attempt=2`,
// so this had to be right before anything else was built on it.
//
// `app/api/twilio/ppl/complete` already signs over the full URL including the query (see
// docs/PPL_VERTICAL.md) — two implementations that disagreed about the same protocol, which is
// the reason to have one.
//
// ⚠️ FAILS CLOSED, AND SILENCE IS NOT A PASS. With no auth token configured there is no way to
// tell a real Twilio request from a forged one, so an unconfigured environment rejects rather
// than waves things through: these endpoints write call records and send SMS.
import twilio from 'twilio';

export type VerifiedWebhook =
  | { ok: true; params: Record<string, string> }
  | { ok: false; reason: 'not_configured' | 'bad_signature' };

/**
 * Verify a Twilio POST and return its form parameters.
 *
 * The caller must not have consumed the body — this reads it.
 */
export async function verifyTwilioWebhook(req: Request): Promise<VerifiedWebhook> {
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());
  if (!authToken) return { ok: false, reason: 'not_configured' };

  const signature = req.headers.get('x-twilio-signature') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || '';
  const u = new URL(req.url);
  // pathname + search — the whole point of this module.
  const url = `${proto}://${host}${u.pathname}${u.search}`;
  if (!twilio.validateRequest(authToken, signature, url, params)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true, params };
}

/**
 * TwiML that ends the call without saying anything.
 *
 * ⚠️ An empty `<Response/>` tells Twilio to HANG UP, which is exactly how a failed forward
 * dropped callers in silence before 2026-09-30. Named so nobody reaches for it by accident:
 * use it when the call is genuinely over, never as a default.
 */
export const HANGUP_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export function xmlResponse(twiml: string): Response {
  return new Response(twiml, { status: 200, headers: { 'Content-Type': 'text/xml' } });
}

/**
 * What to return when a voice webhook cannot authenticate the request.
 *
 * ⚠️ TwiML with a 403, not JSON. A JSON body on a voice URL is a Twilio 12100 parse error and
 * the caller hears "an application error has occurred, goodbye" — the failure that hit the first
 * real tracking-number call on 2026-09-19. Whatever we refuse, the caller should not be shouted
 * at in robot.
 */
export function rejectedTwiml(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Sorry, this line is not available right now.</Say></Response>',
    { status: 403, headers: { 'Content-Type': 'text/xml' } },
  );
}
