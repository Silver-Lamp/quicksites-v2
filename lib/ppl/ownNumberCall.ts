// lib/ppl/ownNumberCall.ts — the business behind a tracking number calls the tracking number.
//
// ⚠️ THE CASE THAT BUILT THIS (2026-10-16, renton-towing.com). A real caller rang the line at
// 2:53 pm and was bridged to V'Z Towing for 30 s. Forty-nine seconds later V'Z Towing rang the
// tracking number BACK — it is the number their phone showed (our caller ID is our own number;
// the customer's number is only in the whisper) — four times in two minutes. Each call was
// forwarded to V'Z Towing's own phone (busy: they were on it), two rang out, and the missed-call
// text fired twice: "someone called — ring them back on (253) 217-0639". Their own number.
//
// A business calling its own line wants ONE thing: the customer it just spoke to or missed. So:
// never bridge a number to itself; say what this line is; give them the last caller's number by
// voice and by text. The number is theirs to have — the whisper already spoke it to them.
export const last10 = (s: string | null | undefined): string => String(s ?? '').replace(/[^0-9]/g, '').slice(-10);

/** True when the inbound caller IS the campaign's forward-to (compared on the last ten digits). */
export function isOwnBusinessCaller(from: string | null | undefined, forwardTo: string | null | undefined): boolean {
  const a = last10(from);
  const b = last10(forwardTo);
  return a.length === 10 && a === b;
}

export type LastCaller = { number: string; at: Date | string };

const usDisplay = (e164: string): string => {
  const d = last10(e164);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
};

/** Digits read one at a time in groups, so TTS does not say "two hundred fifty-three". */
const spoken = (e164: string): string => {
  const d = last10(e164);
  if (d.length !== 10) return e164;
  const g = (s: string) => s.split('').join(' ');
  return `${g(d.slice(0, 3))}, ${g(d.slice(3, 6))}, ${g(d.slice(6))}`;
};

const whenText = (at: Date | string, tz: string): string => {
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(d);
};

export type OwnNumberArgs = { domain: string; lastCaller: LastCaller | null; tz?: string };

/** What the business hears. No bridge; the line explains itself and gives the last caller. */
export function ownBusinessSpeech({ domain, lastCaller, tz = 'America/Los_Angeles' }: OwnNumberArgs): string {
  const head = `This is the ${domain} line, which forwards to your number, so calls from your own phone are not connected.`;
  if (!lastCaller) return `${head} There are no other calls to this line on record yet.`;
  const when = whenText(lastCaller.at, tz);
  return `${head} The last call to it came from ${spoken(lastCaller.number)}${when ? `, at ${when}` : ''}. Repeating: ${spoken(lastCaller.number)}. We are texting it to you now.`;
}

/** The text the business gets, so the number survives the call. */
export function ownBusinessSmsBody({ domain, lastCaller, tz = 'America/Los_Angeles' }: OwnNumberArgs): string | null {
  if (!lastCaller) return null;
  const when = whenText(lastCaller.at, tz);
  return `${domain}: you rang your own forwarding line. The last call to it came from ${usDisplay(lastCaller.number)}${when ? ` at ${when}` : ''}. Call them back on that number.`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);

export function ownBusinessTwiml(args: OwnNumberArgs): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${esc(ownBusinessSpeech(args))}</Say>
  <Hangup/>
</Response>`;
}
