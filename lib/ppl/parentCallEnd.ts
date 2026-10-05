// lib/ppl/parentCallEnd.ts
//
// What the tracking number's PARENT-CALL status callback may write over a call_logs row.
//
// ⚠️ IT NEVER OVERWRITES A DIAL OUTCOME. `/after-dial` writes `dial-*` + the LEG duration, which
// is the destination-health signal; the parent call's `completed` arrives a moment later and must
// not replace it. Only a row with no dial outcome is touched, and it becomes:
//   • `abandoned` — a forward that never got a dial outcome (the caller hung up during the
//                   announcement or the ring; the business was never reached), or
//   • `ended`     — a voicemail-first call, which never dials by design.
// Both classify as `abandoned` for `classifyDial`, which counts them NOWHERE in destination
// health. Pure, so the decision is testable without Twilio or a database.
import { PARENT_ENDED_STATUSES } from '@/lib/ppl/forwardHealth';

/** Statuses that mean "nothing final has been recorded yet" and may be replaced. */
const OPEN_STATUSES = new Set(['', 'ringing', 'initiated', 'queued', 'in-progress']);

/** Twilio parent-call statuses that mean the call is over. */
const TERMINAL = new Set(['completed', 'busy', 'no-answer', 'canceled', 'failed']);

export type ParentEndWrite = { call_status: 'abandoned' | 'ended'; call_duration?: number };

export function parentEndWrite(
  row: { call_status: string | null; handling: string | null } | null,
  parent: { status: string; durationSec: number | null },
): ParentEndWrite | null {
  const current = (row?.call_status ?? '').trim().toLowerCase();
  if (PARENT_ENDED_STATUSES.has(current)) return null; // our own earlier write stands
  if (!OPEN_STATUSES.has(current)) return null; // a dial outcome stands
  if (!TERMINAL.has(parent.status.trim().toLowerCase())) return null; // nothing to conclude yet
  const out: ParentEndWrite = { call_status: row?.handling === 'voicemail_first' ? 'ended' : 'abandoned' };
  if (parent.durationSec !== null && Number.isFinite(parent.durationSec)) out.call_duration = parent.durationSec;
  return out;
}
