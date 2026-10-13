// lib/ppl/missedCallNotice.ts
//
// TELL THE BUSINESS ABOUT A FORWARDED CALL THAT RANG OUT, EVEN WHEN NO MESSAGE WAS LEFT.
//
// ⚠️ THE CASE THAT BUILT THIS (2026-10-07). A caller rang renton-electrical.com twice in two
// days. The second time they sat through the announcement and the whole ring, Madrona Electric
// did not pick up, the caller reached our voicemail prompt and hung up without recording. The
// only text we ever sent a destination came from the voicemail webhook — which Twilio requests
// only when a recording exists — so the business learned nothing about either call. A missed
// call is still a lead for the one party who can return it; the number is the payload.
//
// ⚠️ WHERE IT FIRES: the tracking number's PARENT-CALL status callback, not `/after-dial`. The
// Dial action runs while the caller is still on the line and about to be offered voicemail, so
// at that moment "did they leave a message" is unknowable. The parent `completed` arrives once
// the call is over, when the voicemail webhook has had its chance to claim the row. Deciding
// there means one text per call, never a "rang out" text followed by a "left a message" text.
//
// ⚠️ ONLY `unanswered`. `abandoned` means the caller hung up before the bridge — the business
// was never rung and has nothing to return. `brief` and `connected` mean something picked up
// (a person or their own voicemail), and telling them about a call they took is noise. The
// decision is pure so every branch is pinned without Twilio or a database.
import { classifyDial } from '@/lib/ppl/forwardHealth';

export type MissedCallRow = {
  handling: string | null;
  call_status: string | null;
  call_duration: number | null;
  forwarded_to: string | null;
  recording_url: string | null;
  voicemail_notified_at: string | null;
  missed_call_notified_at: string | null;
};

export type MissedCallSkip =
  | 'not_a_forward'
  | 'no_destination'
  | 'not_unanswered'
  | 'message_left'
  | 'already_notified'
  | 'sweep';

export type MissedCallDecision = { send: true; to: string } | { send: false; reason: MissedCallSkip };

/** Twilio parent-call statuses that mean the call is over. Same set as parentCallEnd.ts. */
const TERMINAL = new Set(['completed', 'busy', 'no-answer', 'canceled', 'failed']);

/**
 * ⚠️ A SWEEP IS NOT A LEAD (2026-10-12). Two numbers rang NINE of our tracking lines in 17
 * seconds — every Vashon trade site in turn, a quarter-second apart. Each ring-out was decided
 * on its own, so five real island businesses were texted "someone called, ring them back on
 * <the robocaller>". Those were, at that point, the only missed-call texts this feature had ever
 * sent. A caller that is working through our numbers is a dialer, and the number is not a payload
 * anyone should return. The signal: how many OTHER of our lines the same caller rang in the last
 * `SWEEP_WINDOW_MINUTES`. One other number can be a person with two sites to call; two or more
 * within minutes is a sweep. Counted by the route (distinct `to_number`), decided here.
 */
export const SWEEP_WINDOW_MINUTES = 10;
export const SWEEP_OTHER_NUMBERS_MIN = 2;

export type MissedCallContext = {
  /** Distinct OTHER tracking numbers this caller rang in the window. Omit when unknown. */
  otherNumbersRungByCaller?: number;
};

/** Pure. Should the destination be texted "someone called and it rang out"? */
export function missedCallDecision(
  row: MissedCallRow | null,
  parent: { status: string },
  ctx: MissedCallContext = {},
): MissedCallDecision | { send: false; reason: 'call_not_over' | 'no_row' } {
  if (!row) return { send: false, reason: 'no_row' };
  if (!TERMINAL.has(parent.status.trim().toLowerCase())) return { send: false, reason: 'call_not_over' };
  if (row.missed_call_notified_at) return { send: false, reason: 'already_notified' };
  if (row.handling !== 'forward') return { send: false, reason: 'not_a_forward' };
  if (!row.forwarded_to) return { send: false, reason: 'no_destination' };
  if (classifyDial(row.call_status, row.call_duration) !== 'unanswered') return { send: false, reason: 'not_unanswered' };
  // The voicemail webhook claims its row synchronously before it texts; if it got there first
  // the business is being told "they left a message", which supersedes this.
  if (row.recording_url || row.voicemail_notified_at) return { send: false, reason: 'message_left' };
  if ((ctx.otherNumbersRungByCaller ?? 0) >= SWEEP_OTHER_NUMBERS_MIN) return { send: false, reason: 'sweep' };
  return { send: true, to: row.forwarded_to };
}

/**
 * How long the status callback waits before re-reading the row and deciding.
 *
 * ⚠️ The parent `completed` and the `<Record action>` callback can arrive within the same second
 * when the caller hangs up mid-recording. Reading the row immediately would see no recording,
 * text "rang out", and a moment later the voicemail route would text "left a message". A short
 * wait lets the voicemail claim land first; it runs in `after()`, so the caller never waits on it.
 */
export const MISSED_CALL_SETTLE_MS = 8_000;
