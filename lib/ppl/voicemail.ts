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

/** For an XML ATTRIBUTE — quotes included, because they would close the attribute. */
function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

/**
 * For TEXT a voice reads aloud — only the three characters XML requires.
 *
 * Same split as `lib/ppl/cascade.ts`: escaping quotes inside `<Say>` renders "couldn&apos;t"
 * beside a literal "I'll", which Polly reads identically, so nothing sounds wrong and the
 * inconsistency survives. Attributes use `esc`; speech uses this.
 */
function escText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
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

/**
 * VOICEMAIL-FIRST: no business is rung at all. The caller leaves a message and we get it to a
 * local company (docs/CALL_CASCADE_PLAN.md §13).
 *
 * ⚠️ IT PROMISES A RELAY, NOT A CALLBACK TIME, AND NOT A COMPANY. We cannot promise anyone will
 * ring back — nobody has agreed to anything at the moment this plays — so it says what we will
 * do ("pass it to local towing companies"), never what they will do. "Someone will call you
 * right back" is a claim about a third party we have no contract with, and it is the sentence
 * this wording exists to avoid.
 *
 * ⚠️ AND IT DISCLOSES THE ONWARD DISCLOSURE. The message and the caller's number go to
 * businesses. Saying so is what separates this from quietly brokering a stranger's details; it
 * is also what makes the whole model honest enough to advertise.
 *
 * ⚠️ While the experiment runs, the relay is a PERSON doing it by hand. That does not change
 * what the caller is told, because from their side the promise is identical and it is kept.
 */
export function voicemailFirstPromptTwiml(opts: {
  trade: string;
  city: string | null;
  recordActionUrl: string;
  /**
   * A recording of the operator reading the greeting. Optional.
   *
   * ⚠️ IT IS A REAL RECORDING OF A REAL PERSON, NOT A CLONE, and that is why it needs no
   * label. The audio-honesty standard's rule 2 governs a person's voice being *synthesised* —
   * it must be a consented clone with `voice_basis: 'self'` reported, or it reads as unknown.
   * None of that applies to someone recording their own greeting, which is what every business
   * phone line in the world already is. A cloned version would also be permitted (it is the
   * sanctioned case) and buys nothing here: the script is short, static, and the partner-audio
   * seam is inert.
   *
   * ⚠️ The standard's outbound extension — disclose-first, name the origin — governs calls WE
   * place to someone who did not summon them. This is inbound: they dialled us. Consent is
   * present by the strongest possible action.
   */
  greetingUrl?: string | null;
}): string {
  const where = opts.city ? ` in ${opts.city}` : '';
  // ⚠️ FALLS BACK TO TTS, never to silence. If the file is missing or the CDN 404s, Twilio logs
  // the failed <Play> and moves to the next verb — so without a <Say> alongside it the caller
  // would hit the beep with no instruction at all, which is worse than a robot voice. The
  // recording is an improvement on the prompt, never a dependency of it.
  const greeting = opts.greetingUrl
    ? `<Play>${esc(opts.greetingUrl)}</Play>`
    : `<Say voice="Polly.Joanna">Thanks for calling. Leave a message after the tone with your number and what you need, and I'll pass it to ${escText(opts.trade)} companies${escText(where)} so one can call you back.</Say>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greeting}
  <Record maxLength="120" playBeep="true" trim="trim-silence" action="${esc(opts.recordActionUrl)}" method="POST"/>
  <Say voice="Polly.Joanna">I didn't get a message. Please try again shortly.</Say>
</Response>`;
}

/**
 * The script to read, and the only thing that has to stay true of the recording.
 *
 * ⚠️ A RECORDING CANNOT INTERPOLATE, so the spoken version drops the city and trade that the
 * TTS version names. That is a deliberate trade and it is the honest direction: "local
 * companies in the area" claims less than "towing companies in Covington", so one file is safe
 * on every campaign. Per-city recordings can come later; a generic one cannot be WRONG on a
 * campaign nobody remembered to re-record.
 *
 * Exported so a test can pin that the written script still matches what the fallback says, and
 * so the operator has one place to read from.
 */
export const VOICEMAIL_GREETING_SCRIPT =
  "Thanks for calling. Leave a message after the tone with your number and what you need, " +
  "and I'll pass it to local companies in the area so one can call you back.";

/**
 * Where the recorded greeting lives, or null to use TTS.
 *
 * ⚠️ Unset is a supported, working state — not a broken one. The prompt degrades to the voice
 * that has been serving callers all along.
 */
export function voicemailGreetingUrl(): string | null {
  const u = (process.env.VOICEMAIL_GREETING_URL || '').trim();
  return u.startsWith('https://') ? u : null;
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
/**
 * Tell the operator a voicemail-first message landed, so they can relay it by hand.
 *
 * ⚠️ BOTH CHANNELS, AND IT SAYS WHICH ONES WORKED. The caller was promised a relay; an
 * unnoticed notification breaks that promise while looking fine from here. Email always (the
 * addresses are already configured), SMS as well when `OPERATOR_ALERT_SMS` is set — because at
 * roughly one call every five days an email can sit unread for a day and the lead is cold.
 *
 * ⚠️ It never throws. A notification failure must not make the Twilio webhook non-2xx, which
 * would have Twilio retry the whole thing and re-record the caller.
 */
export async function notifyOperatorOfVoicemail(opts: {
  domain: string;
  callerPhone: string | null;
  link: string;
  hasRecording: boolean;
  /**
   * From lib/ppl/voicemailSpeech.ts. ⚠️ `no_speech` changes the ask: nobody is told to relay a
   * fax tone. `unknown` (transcription failed) keeps the original "listen" wording — it must
   * never read as "nothing there".
   */
  speech?: 'speech' | 'no_speech' | 'unknown';
  transcript?: string | null;
}): Promise<{ email: boolean; sms: boolean }> {
  const caller = opts.callerPhone ? formatUsPhone(opts.callerPhone) : 'unknown number';
  const speech = opts.speech ?? 'unknown';
  const noSpeech = opts.hasRecording && speech === 'no_speech';
  const excerpt = (opts.transcript ?? '').trim();
  const body = !opts.hasRecording
    ? `Call on ${opts.domain} from ${caller} — reached the prompt but left no message.`
    : noSpeech
      ? `Voicemail on ${opts.domain} from ${caller} contains no speech — likely a fax machine or robocall. Listen if you want: ${opts.link}`
      : `New lead on ${opts.domain} from ${caller}.${excerpt ? ` They said: "${excerpt.length > 280 ? `${excerpt.slice(0, 277)}…` : excerpt}"` : ''} Listen: ${opts.link}`;

  let email = false;
  let sms = false;
  try {
    const admins = String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (admins.length) {
      const { sendEmail } = await import('@/lib/email');
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await sendEmail({
        to: admins,
        subject: `[QuickSites] ${!opts.hasRecording ? 'Hang-up' : noSpeech ? 'Voicemail, no speech (likely fax or robocall)' : 'Lead'} — ${opts.domain}`,
        html:
          `<p>${esc(body)}</p>` +
          (noSpeech
            ? `<p>Nothing to relay. Twenty seconds of transcription found no words; if that is wrong, the recording is at the link.</p>`
            : `<p>Relay it to a local business, then note who took it.</p>`),
      });
      email = true;
    }
  } catch {
    /* never throw — see the header */
  }

  try {
    const phone = (process.env.OPERATOR_ALERT_SMS || '').trim();
    if (phone) {
      const { sendSms } = await import('@/lib/sms/sendSms');
      const r = await sendSms(phone, body);
      sms = !!r.ok;
    }
  } catch {
    /* never throw */
  }
  return { email, sms };
}

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
