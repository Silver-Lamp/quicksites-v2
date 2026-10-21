// lib/ppl/callerScreen.ts — PURE half of caller screening (DB half: lib/ppl/callerScreenDb.ts).
//
// Owner, 2026-10-15: "if we detect an Angie's lead call can we not forward?" Yes — as a SCREEN,
// not a hang-up. A screened number is not bridged to the business; the line says so and takes a
// voicemail, which the existing pipeline transcribes, judges and relays. So the cost of a wrong
// screen is a customer leaving a message instead of talking — recoverable — while the cost of
// forwarding a lead-gen pitch is a business paying for, or losing patience with, our line.
//
// ⚠️ TWO WAYS ONTO THE LIST, NEITHER IS THE MODEL ALONE. (1) A person, from /admin/call-logs.
// (2) Automatically, when a voicemail was judged `not_lead` AND its transcript names a lead-gen
// vendor in the caller's own words — a deterministic match below, so "Hi, this is Angie, my sink
// is leaking" (a customer called Angie) never screens anyone. The verdict alone is an inference;
// the vendor's name in the transcript is evidence.

export type VendorMatch = { vendor: string; matched: string };

/**
 * Lead-gen / marketing vendors as they introduce themselves on a voicemail. Each pattern needs the
 * "I'm calling FROM / WITH / AT <vendor>" shape or an unambiguous product name, never a bare first
 * name. Add a line when a new vendor leaves a message; a test pins the customer-named-Angie case.
 */
export const VENDOR_PATTERNS: Array<{ vendor: string; re: RegExp }> = [
  { vendor: 'Angi', re: /\b(?:from|with|at|over at|calling from|on behalf of)\s+angi(?:e|e's|es)?(?:\s+list|\s+leads|\s+ads)?\b/i },
  { vendor: 'Angi', re: /\bangie'?s\s+list\b/i },
  { vendor: 'HomeAdvisor', re: /\bhome\s?advisor\b/i },
  { vendor: 'Thumbtack', re: /\bthumbtack\b/i },
  { vendor: 'Networx', re: /\bnetworx\b/i },
  { vendor: 'Porch', re: /\bporch\.com\b|\b(?:from|with|at)\s+porch\b/i },
  { vendor: 'Yelp', re: /\b(?:from|with|at|calling from)\s+yelp\b/i },
  { vendor: 'Google listing sales', re: /\b(?:your|the)\s+google\s+(?:business\s+)?(?:listing|profile)\b.*\b(?:verify|update|claim|optimi[sz]e)\b|\b(?:verify|update|claim|optimi[sz]e)\b.*\bgoogle\s+(?:business\s+)?(?:listing|profile)\b/i },
  { vendor: 'Houzz', re: /\b(?:from|with|at|calling from)\s+houzz\b/i },
  { vendor: 'Bark', re: /\b(?:from|with|at|calling from)\s+bark(?:\.com)?\b/i },
];

export function vendorVoicemailMatch(transcript: string | null | undefined): VendorMatch | null {
  const t = (transcript ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  for (const { vendor, re } of VENDOR_PATTERNS) {
    const m = t.match(re);
    if (m) return { vendor, matched: m[0] };
  }
  return null;
}

/** Only a not-a-lead verdict PLUS a vendor name in the words screens automatically. */
export function shouldAutoScreen(input: { verdict: string | null | undefined; transcript: string | null | undefined }): VendorMatch | null {
  if (input.verdict !== 'not_lead') return null;
  return vendorVoicemailMatch(input.transcript);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);

/** What a screened caller hears. Spoken, honest, and it leaves the customer path open. */
export const SCREEN_PROMPT =
  "Thanks for calling. This number doesn't connect sales or marketing calls to the business. " +
  'If you are a customer, leave a message after the tone with your number and what you need, and it will be passed on.';

export function screenPromptTwiml(opts: { recordActionUrl: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${esc(SCREEN_PROMPT)}</Say>
  <Record maxLength="120" playBeep="true" trim="trim-silence" action="${esc(opts.recordActionUrl)}" method="POST"/>
  <Say voice="Polly.Joanna">I didn't get a message. Goodbye.</Say>
</Response>`;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// BLOCKS (owner, 2026-10-21: "repeat robocallers being reported from 2 calls today, can we start
// a block list and just block or drop them"). A blocked number is REJECTED before the call is
// answered: no prompt, no recording, no text to the business, no alert email. Reserved for
// numbers whose own behaviour on our lines proves a dialer — screening stays the default for a
// number that might be a person (a vendor's rep can also be a customer next week).
//
// ⚠️ TWO WAYS ONTO THE BLOCK LIST, NEITHER IS THE MODEL ALONE. (1) A person, from
// /admin/call-logs. (2) `repeatPatternDecision`: our OWN call records show the number ringing
// several of our lines, repeatedly, never connecting, never leaving a message. The AI read says
// "robocall" about such a number too, but the read is an inference and the pattern is evidence —
// the same line drawn for vendor screens. +12067102328 was the case: 4 sub-5-second abandoned
// calls across 2 lines on 2026-10-21 on top of ~10 like them, every one emailed to the owner.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type ScreenMode = 'screen' | 'block';

/** TwiML that rejects the call unanswered. Twilio's `rejected` plays a standard rejection; no greeting, no record. */
export function rejectTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Reject reason="rejected"/>
</Response>`;
}

/** A prior call from the same number, as the entry route reads it from `call_logs`. */
export type PriorCall = {
  to_number: string | null;
  call_status: string | null;
  call_duration: number | null;
  handling: string | null;
  recording_url: string | null;
  voicemail_speech: string | null;
  created_at: string;
};

export const REPEAT_WINDOW_DAYS = 30;
/** Calls in the window before the pattern counts. */
export const REPEAT_MIN_CALLS = 5;
/** Distinct tracking numbers rung — one business called five times may be a customer; two or more is a dialer working a list. */
export const REPEAT_MIN_LINES = 2;
/** A call this long (seconds) or longer is "connected" and disqualifies the pattern (classifyDial's own threshold). */
export const REPEAT_CONNECTED_SECONDS = 15;

export type RepeatPatternVerdict = { block: true; evidence: string } | { block: false; reason: 'too_few_calls' | 'one_line' | 'a_call_connected' | 'a_message_was_left' };

/**
 * Pure. Does this number's own history on our lines prove a dialer?
 *
 * Every call in the window must be short (< REPEAT_CONNECTED_SECONDS, or no duration at all —
 * abandoned before any bridge), and none may carry a recording with speech. One connected call
 * or one spoken message is a person, and a person is screened at most, never blocked here.
 * Calls already blocked are not counted (they prove only that we blocked them).
 */
export function repeatPatternDecision(prior: PriorCall[], nowMs = Date.now()): RepeatPatternVerdict {
  const since = nowMs - REPEAT_WINDOW_DAYS * 86_400_000;
  const calls = prior.filter((c) => {
    const t = Date.parse(c.created_at);
    return Number.isFinite(t) && t >= since && c.handling !== 'blocked';
  });
  if (calls.length < REPEAT_MIN_CALLS) return { block: false, reason: 'too_few_calls' };
  const lines = new Set(calls.map((c) => c.to_number).filter(Boolean));
  if (lines.size < REPEAT_MIN_LINES) return { block: false, reason: 'one_line' };
  for (const c of calls) {
    const s = (c.call_status ?? '').toLowerCase();
    const dur = typeof c.call_duration === 'number' ? c.call_duration : null;
    if ((dur !== null && dur >= REPEAT_CONNECTED_SECONDS) || s === 'dial-completed' || s === 'answered' || s === 'connected') {
      return { block: false, reason: 'a_call_connected' };
    }
    if (c.voicemail_speech === 'speech' || (c.recording_url && c.voicemail_speech !== 'no_speech')) {
      return { block: false, reason: 'a_message_was_left' };
    }
  }
  const first = calls.map((c) => c.created_at).sort()[0];
  return {
    block: true,
    evidence: `${calls.length} calls to ${lines.size} of our lines since ${first.slice(0, 10)}, none over ${REPEAT_CONNECTED_SECONDS}s, no message left (repeat pattern, lib/ppl/callerScreen.ts)`,
  };
}

/** E.164 normalisation for the list key: "+1 (206) 555-0100" → "+12065550100"; a 10-digit US number gets +1. */
export function screenKey(number: string | null | undefined): string | null {
  const d = (number ?? '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}
