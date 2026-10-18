// lib/ppl/outcomeSurvey.ts — "did that call become a job?" asked of the business, for the record.
//
// Owner, 2026-10-18 (the pricing discussion): bill the 90-second call, MEASURE conversion. A
// self-report that sets the bill invites "no" from everyone; a self-report with nothing riding on
// it is biased only by memory. So: after a call the business took that ran at least the billable
// floor, on the trade's own clock (a tow resolves in an hour, a plumbing quote in a week), ONE
// text: Y / N / NOT YET, "this changes nothing on your bill". The reply lands on the call row;
// the statement shows "you told us N of M became jobs"; the pitch tool shows it too.
//
// ⚠️ Never the caller. They dialled a page headed with a name that is not ours and never agreed
// to hear from us; a text from an unknown number asking whether they hired the plumber is the
// thing people screenshot. Only the business, who already gets our texts and can STOP them.
import { classifyDial } from '@/lib/ppl/forwardHealth';
import { isOwnBusinessCaller, last10 } from '@/lib/ppl/ownNumberCall';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';

export function outcomeSurveyEnabled(): boolean {
  const v = process.env.PPL_OUTCOME_SURVEY_ENABLED;
  return v === '1' || v === 'true';
}

/** Hours after the call before asking — the trade's own clock. */
export const OUTCOME_DELAY_HOURS: Record<string, number> = {
  towing: 24,
  auto_repair: 72,
  windshield_repair: 72,
};
export const OUTCOME_DELAY_DEFAULT_HOURS = 7 * 24;
/** Do not ask about a call older than this — nobody remembers which call it was. */
export const OUTCOME_MAX_AGE_HOURS = 30 * 24;

const JUNK_READS = new Set(['vendor_or_sales', 'robocall', 'wrong_number', 'own_business', 'operator_test']);

export type OutcomeSurveyRow = {
  handling: string | null;
  call_status: string | null;
  call_duration: number | null;
  forwarded_to: string | null;
  from_number: string | null;
  created_at: string;
  outcome_survey_sent_at: string | null;
  /** `analysis->>'read'` when the per-call read ran. */
  read?: string | null;
};

export type OutcomeSkip = 'no_row' | 'already_asked' | 'not_a_forward' | 'no_destination' | 'own_business' | 'not_taken' | 'under_floor' | 'junk_read' | 'too_old';
export type OutcomeDecision = { send: true; to: string } | { send: false; reason: 'wait'; dueAt: string } | { send: false; reason: OutcomeSkip };

export function outcomeDelayHours(industry: string | null | undefined): number {
  return OUTCOME_DELAY_HOURS[industry ?? ''] ?? OUTCOME_DELAY_DEFAULT_HOURS;
}

export function outcomeSurveyDecision(row: OutcomeSurveyRow | null, opts: { industry: string | null; nowMs?: number; minBillableSeconds?: number }): OutcomeDecision {
  if (!row) return { send: false, reason: 'no_row' };
  if (row.outcome_survey_sent_at) return { send: false, reason: 'already_asked' };
  if (row.handling !== 'forward') return { send: false, reason: 'not_a_forward' };
  if (!row.forwarded_to) return { send: false, reason: 'no_destination' };
  if (isOwnBusinessCaller(row.from_number, row.forwarded_to)) return { send: false, reason: 'own_business' };
  if (row.read && JUNK_READS.has(row.read)) return { send: false, reason: 'junk_read' };
  if (classifyDial(row.call_status, row.call_duration) !== 'connected') return { send: false, reason: 'not_taken' };
  const floor = opts.minBillableSeconds ?? PPL_DEFAULTS.minBillableSeconds;
  if ((row.call_duration ?? 0) < floor) return { send: false, reason: 'under_floor' };
  const now = opts.nowMs ?? Date.now();
  const at = Date.parse(row.created_at);
  if (!Number.isFinite(at)) return { send: false, reason: 'too_old' };
  if (now - at > OUTCOME_MAX_AGE_HOURS * 3_600_000) return { send: false, reason: 'too_old' };
  const dueAt = at + outcomeDelayHours(opts.industry) * 3_600_000;
  if (now < dueAt) return { send: false, reason: 'wait', dueAt: new Date(dueAt).toISOString() };
  return { send: true, to: row.forwarded_to };
}

const usDisplay = (e164: string | null): string => {
  const d = last10(e164);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(e164 ?? '');
};

export function outcomeSurveySmsText(args: { domain: string; callerPhone: string | null; at: string | Date; tz?: string }): string {
  const tz = args.tz ?? 'America/Los_Angeles';
  const d = typeof args.at === 'string' ? new Date(args.at) : args.at;
  const when = Number.isNaN(d.getTime()) ? 'recently' : new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(d);
  const from = last10(args.callerPhone).length === 10 ? ` from ${usDisplay(args.callerPhone)}` : '';
  // "For our records only" and "changes nothing on your bill" are the whole point: no money rides
  // on the answer, so the answer can be true. One question, three replies, STOP honoured.
  return `${args.domain}, for our records only: did the call ${when}${from} become a job? Reply Y, N or NOT YET. This changes nothing on your bill. Reply STOP to stop these texts.`;
}

export type OutcomeReply = 'job' | 'no_job' | 'not_yet';

/** What a business texted back, or null when it is not an answer to the question. */
export function parseOutcomeReply(body: string | null | undefined): OutcomeReply | null {
  const t = String(body ?? '').trim().toLowerCase().replace(/[.!]+$/, '');
  if (!t) return null;
  if (/^(not yet|notyet|later|pending|maybe|soon|waiting|quoted|quote out)$/.test(t)) return 'not_yet';
  if (/^(y|yes|yep|yeah|yup|job|booked|done|hired|got it|we did|yes it did)$/.test(t)) return 'job';
  if (/^(n|no|nope|nah|no job|didn'?t|did not|not a job|lost it)$/.test(t)) return 'no_job';
  return null;
}

export function outcomeReplyAck(reply: OutcomeReply): string {
  return reply === 'job' ? 'Noted as a job — thanks.' : reply === 'no_job' ? 'Noted, not a job — thanks.' : 'Noted, not yet — we will leave it there. Thanks.';
}

export type OutcomeStats = { asked: number; answered: number; jobs: number; noJobs: number; notYet: number };

export function outcomeStats(rows: Array<{ outcome_survey_sent_at: string | null; outcome_reported: string | null }>): OutcomeStats {
  const s: OutcomeStats = { asked: 0, answered: 0, jobs: 0, noJobs: 0, notYet: 0 };
  for (const r of rows) {
    if (!r.outcome_survey_sent_at) continue;
    s.asked += 1;
    if (r.outcome_reported === 'job') { s.answered += 1; s.jobs += 1; }
    else if (r.outcome_reported === 'no_job') { s.answered += 1; s.noJobs += 1; }
    else if (r.outcome_reported === 'not_yet') { s.answered += 1; s.notYet += 1; }
  }
  return s;
}

/** The sentence the statement and the pitch tool show — says only what the business told us. */
export function outcomeSentence(s: OutcomeStats): string | null {
  if (!s.asked) return null;
  if (!s.answered) return `We asked about ${s.asked} call${s.asked === 1 ? '' : 's'}; no answer yet.`;
  const parts = [`${s.jobs} became ${s.jobs === 1 ? 'a job' : 'jobs'}`];
  if (s.noJobs) parts.push(`${s.noJobs} did not`);
  if (s.notYet) parts.push(`${s.notYet} not yet`);
  return `You told us: of ${s.answered} call${s.answered === 1 ? '' : 's'} asked about, ${parts.join(', ')}.`;
}
