// lib/ppl/voicemail.ts
//
// WHAT A CALLER HEARS WHEN NOBODY PICKS UP, AND WHAT THE BUSINESS IS TOLD ABOUT IT.
// Phase 0 of docs/CALL_CASCADE_PLAN.md. Pure text + a signed playback link; all I/O is in the
// routes.
//
// Before this, a failed forward returned an empty `<Response/>` and Twilio hung up. The caller
// heard "please hold while we connect you", then ringing, then nothing — confirmed live on
// 2026-09-30 — and the business never learned the call had happened. Two real leads were lost
// that way in one morning.
//
// ⚠️ THE COPY MAY NOT IMPLY THE CALLER REACHED THE BUSINESS, OR THAT WE VET ANYONE. These are
// businesses that mostly have never spoken to us. `FORBIDDEN_IVR_PHRASES` covers the same
// ground for the PPL IVR and is asserted against this module's strings too.
import crypto from 'node:crypto';
import { formatUsPhone } from '@/lib/phone/formatUs';

/** How long a texted voicemail link keeps working. */
export const VOICEMAIL_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.PPL_STATEMENT_SECRET ||
    process.env.CLAIM_TOKEN_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  );
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(`qs-voicemail:${body}`).digest('base64url');
}

/**
 * A link the business can actually open.
 *
 * ⚠️ NEVER TEXT THE TWILIO RECORDING URL. `api.twilio.com/…/Recordings/RE…` requires our account
 * credentials, so a business tapping it gets a 401 — a link that looks delivered and plays
 * nothing, which is worse than sending no link at all. This token resolves to a route that
 * fetches the audio with our auth and streams it.
 */
export function mintVoicemailToken(callSid: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ c: callSid, exp: now + VOICEMAIL_LINK_TTL_MS })).toString(
    'base64url',
  );
  return `${body}.${sign(body)}`;
}

export function verifyVoicemailToken(
  token: string | null | undefined,
  now = Date.now(),
): { callSid: string } | null {
  if (!token || typeof token !== 'string' || !secret()) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p?.c || typeof p.exp !== 'number' || now > p.exp) return null;
    return { callSid: String(p.c) };
  } catch {
    return null;
  }
}

export function voicemailUrl(callSid: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/voicemail/${encodeURIComponent(mintVoicemailToken(callSid))}`;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

/**
 * What the caller hears when the forward did not connect.
 *
 * ⚠️ "I couldn't reach them" — not "they are busy", not "all our operators are engaged", and
 * never a reason we have not verified. We know the dial did not connect; we do not know why,
 * and inventing one is the same class of lie as `FORBIDDEN_IVR_PHRASES`' "at capacity".
 */
export function voicemailPromptTwiml(opts: { recordActionUrl: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, I couldn't reach them just now. Leave a message after the tone and I'll pass it straight to them, along with your number.</Say>
  <Record maxLength="120" playBeep="true" trim="trim-silence" action="${esc(opts.recordActionUrl)}" method="POST"/>
  <Say voice="Polly.Joanna">I didn't get a message. Please try again shortly.</Say>
</Response>`;
}

/** After the caller leaves a message. Short: they are done and want to hang up. */
export function voicemailThanksTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Got it — I'll pass that on right away. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

/**
 * The SMS telling a business about a call it missed.
 *
 * ⚠️ THE CALLBACK NUMBER IS THE PAYLOAD, NOT THE RECORDING. A tow operator wants a number to
 * ring, not an audio file to play in a truck. The link is there for context; the digits are the
 * lead, so they come first and survive a truncated preview.
 *
 * ⚠️ Carries STOP because this is a NEW KIND of message. The forwarding notice covered "calls
 * are being forwarded to you"; it did not cover us texting them about missed ones, and a
 * recipient must be able to end it without ending the calls.
 */
export function missedCallSmsText(opts: {
  domain: string;
  callerPhone: string | null;
  link: string;
  senderName?: string | null;
  hasRecording: boolean;
}): string {
  const first = (opts.senderName ?? '').trim().split(/\s+/)[0] || '';
  const who = first ? `${first} here from QuickSites.` : 'This is QuickSites.';
  const caller = opts.callerPhone ? formatUsPhone(opts.callerPhone) : 'a number we did not get';
  const tail = opts.hasRecording
    ? `They left a message: ${opts.link}`
    : `They didn't leave a message.`;
  return (
    `${who} Someone called ${opts.domain} and it rang out. ` +
    `Call them back on ${caller}. ${tail} Reply STOP to stop these texts.`
  );
}
