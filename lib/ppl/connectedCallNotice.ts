// lib/ppl/connectedCallNotice.ts — after a bridged call, text the business the caller's number.
//
// Owner, 2026-10-16: "text them the number as well". The whisper speaks the caller's number once,
// while the business is picking up; their phone log then shows OUR tracking number (caller ID is
// our own, see the entry route). V'Z Towing rang their own line back four times looking for the
// customer they had just spoken to. So every call the business took now ends with a text that
// carries the number. Pure decision + copy; the after-dial route runs it in `after()`.
import { classifyDial, CONNECTED_MIN_SECONDS } from '@/lib/ppl/forwardHealth';
import { isOwnBusinessCaller, last10 } from '@/lib/ppl/ownNumberCall';

export type ConnectedCallRow = {
  handling: string | null;
  call_status: string | null;
  call_duration: number | null;
  forwarded_to: string | null;
  from_number: string | null;
  connected_notified_at: string | null;
};

export type ConnectedCallSkip = 'no_row' | 'not_a_forward' | 'no_destination' | 'no_caller' | 'not_taken' | 'own_business' | 'already_notified';
export type ConnectedCallDecision = { send: true; to: string } | { send: false; reason: ConnectedCallSkip };

/**
 * Text only when the business actually TOOK the call (`connected`, or `brief` — a short exchange
 * still happened and the number is the thing they lack). A ring-out is the missed-call text's
 * job; a voicemail is the voicemail text's. Never for a business calling its own line.
 */
export function connectedCallDecision(row: ConnectedCallRow | null): ConnectedCallDecision {
  if (!row) return { send: false, reason: 'no_row' };
  if (row.connected_notified_at) return { send: false, reason: 'already_notified' };
  if (row.handling !== 'forward') return { send: false, reason: 'not_a_forward' };
  if (!row.forwarded_to) return { send: false, reason: 'no_destination' };
  if (last10(row.from_number).length < 7) return { send: false, reason: 'no_caller' };
  if (isOwnBusinessCaller(row.from_number, row.forwarded_to)) return { send: false, reason: 'own_business' };
  const outcome = classifyDial(row.call_status, row.call_duration);
  if (outcome !== 'connected' && outcome !== 'brief') return { send: false, reason: 'not_taken' };
  return { send: true, to: row.forwarded_to };
}

const usDisplay = (e164: string): string => {
  const d = last10(e164);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
};

/**
 * Under this many seconds the call was a `brief` one (the same boundary `classifyDial` uses): the
 * business picked up and it was over almost at once. The number still goes out, but without an
 * instruction to call back.
 *
 * ⚠️ Why (2026-10-19, owner): a 310 number rang vashon-plumbing.com at 8:17 on a Sunday, Midsound
 * answered, the call lasted 5 s — the robocall shape — and the text told a business pitched the
 * day before to "call them back". Accurate, and the wrong advice. A short call gets the facts
 * (number, time, "5 seconds") and the explanation of their phone log; the call-back line is for
 * a call that was actually a conversation.
 */
export const SHORT_CALL_SECONDS = CONNECTED_MIN_SECONDS;

export function connectedCallSmsText(args: { domain: string; callerPhone: string; durationSeconds: number | null; at?: Date | string; tz?: string }): string {
  const tz = args.tz ?? 'America/Los_Angeles';
  const d = args.at ? (typeof args.at === 'string' ? new Date(args.at) : args.at) : new Date();
  const when = Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d);
  const secs = typeof args.durationSeconds === 'number' && args.durationSeconds > 0 ? args.durationSeconds : null;
  const number = usDisplay(args.callerPhone);
  // Says exactly what we know: which site, which number, when, how long. No "lead", no judgement
  // of what was said — the business was on the call; we were not.
  if (secs !== null && secs < SHORT_CALL_SECONDS) {
    return `${args.domain}: a ${secs}-second call${when ? ` at ${when}` : ''} came in from ${number} and ended almost at once. That is the number, in case you want it — your phone shows our forwarding line instead.`;
  }
  const dur = secs !== null ? `, ${secs} s` : '';
  return `${args.domain}: the call you just took${when ? ` (${when}${dur})` : ''} came from ${number}. Call them back on that number — your phone shows our forwarding line instead.`;
}
