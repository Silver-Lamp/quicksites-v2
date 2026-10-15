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

/** E.164 normalisation for the list key: "+1 (206) 555-0100" → "+12065550100"; a 10-digit US number gets +1. */
export function screenKey(number: string | null | undefined): string | null {
  const d = (number ?? '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}
