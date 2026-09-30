// lib/ppl/forwardHealth.ts
//
// IS THE FORWARD-TO ACTUALLY PICKING UP?
//
// A tracking number that rings a business nobody answers is worse than one that rings nowhere:
// the caller waits through "please hold while we connect you" before giving up, and every
// dashboard reads a call as delivered. covingtontow.com dropped two real leads that way on
// 2026-09-30 and it was found by the operator dialling his own site.
//
// ⚠️ THE OUTCOME VOCABULARY IS TWILIO'S AND IT IS MISLEADING IN ONE PLACE. `DialCallStatus`
// `completed` means the dialled leg ENDED NORMALLY, which includes voicemail answering and the
// caller hanging up mid-ring. It does NOT mean a person picked up. So `answered` here is
// completed AND long enough to be a conversation; anything shorter is counted separately as
// `brief` rather than quietly folded into either side. Calling a 4-second voicemail pickup an
// answered lead is the flattering reading, and the flattering reading is what let this run.
//
// ⚠️ ONLY ROWS THAT RECORD THEIR OWN DESTINATION COUNT. `call_logs.forwarded_to` is written at
// dial time (20260861); rows predating it are NULL and are reported as `unattributed` rather
// than assigned to whoever holds the line today. A re-point must not inherit the previous
// destination's failures — that is the same wrong-instance error as measuring the marketing
// pages and concluding the tenant sites were fine.
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Seconds a bridged call must last to count as answered by a person.
 *
 * Chosen to sit above voicemail pickup (a greeting starts within a second or two of the leg
 * being "answered") and below any real exchange. The PPL biller uses 90s for a BILLABLE lead,
 * which is a different and stricter question — this one is only "did a human take the call".
 */
export const ANSWERED_MIN_SECONDS = 15;

/** Twilio dial outcomes that mean the destination never took the call. */
const UNANSWERED_STATUSES = new Set([
  'dial-no-answer',
  'dial-busy',
  'dial-failed',
  'dial-canceled',
  'no-answer',
  'busy',
  'failed',
]);

export type DialOutcome = 'answered' | 'brief' | 'unanswered' | 'in_progress';

export function classifyDial(status: string | null, durationSec: number | null): DialOutcome {
  const s = (status ?? '').trim().toLowerCase();
  if (UNANSWERED_STATUSES.has(s)) return 'unanswered';
  if (s === 'dial-completed' || s === 'completed' || s === 'answered') {
    return (durationSec ?? 0) >= ANSWERED_MIN_SECONDS ? 'answered' : 'brief';
  }
  // 'ringing', 'initiated', 'in-progress' and anything unrecognised. Deliberately NOT counted as
  // a failure: an unknown status is missing information, and inventing a verdict from it would
  // put a business on the unresponsive list for a vocabulary change at Twilio.
  return 'in_progress';
}

export type DestinationHealth = {
  phone: string;
  answered: number;
  brief: number;
  unanswered: number;
  inProgress: number;
  lastAnsweredAt: string | null;
  lastCallAt: string | null;
  /** Campaign domains that have dialled this number. */
  domains: string[];
};

export type CampaignForwardHealth = {
  campaignId: string;
  domain: string | null;
  /** The destination these counts belong to — the one on the CALL rows, not the campaign. */
  phone: string;
  answered: number;
  brief: number;
  unanswered: number;
  inProgress: number;
  lastAnsweredAt: string | null;
  lastCallAt: string | null;
};

type CallRow = {
  geo_campaign_id: string | null;
  custom_domain: string | null;
  forwarded_to: string | null;
  call_status: string | null;
  call_duration: number | null;
  timestamp: string | null;
};

function blank<T extends object>(base: T) {
  return { answered: 0, brief: 0, unanswered: 0, inProgress: 0, lastAnsweredAt: null as string | null, lastCallAt: null as string | null, ...base };
}

function tally(acc: { answered: number; brief: number; unanswered: number; inProgress: number; lastAnsweredAt: string | null; lastCallAt: string | null }, row: CallRow) {
  const outcome = classifyDial(row.call_status, row.call_duration);
  if (outcome === 'answered') acc.answered += 1;
  else if (outcome === 'brief') acc.brief += 1;
  else if (outcome === 'unanswered') acc.unanswered += 1;
  else acc.inProgress += 1;

  const ts = row.timestamp;
  if (ts) {
    if (!acc.lastCallAt || ts > acc.lastCallAt) acc.lastCallAt = ts;
    if (outcome === 'answered' && (!acc.lastAnsweredAt || ts > acc.lastAnsweredAt)) {
      acc.lastAnsweredAt = ts;
    }
  }
}

/**
 * Dial outcomes per campaign, for the destination the calls actually went to.
 *
 * Keyed by campaign AND phone, so a campaign that was re-pointed shows two rows rather than one
 * blended verdict. That is the whole point of recording `forwarded_to`.
 */
export async function loadCampaignForwardHealth(
  opts: { sinceDays?: number } = {},
): Promise<{ rows: CampaignForwardHealth[]; unattributed: number }> {
  const since = new Date(Date.now() - (opts.sinceDays ?? 90) * 86_400_000).toISOString();
  const { data } = await supabaseAdmin
    .from('call_logs')
    .select('geo_campaign_id, custom_domain, forwarded_to, call_status, call_duration, timestamp')
    .not('geo_campaign_id', 'is', null)
    .gte('timestamp', since)
    .limit(5000);

  const byKey = new Map<string, CampaignForwardHealth>();
  let unattributed = 0;
  for (const row of (data ?? []) as CallRow[]) {
    if (!row.forwarded_to) {
      unattributed += 1;
      continue;
    }
    const key = `${row.geo_campaign_id}|${row.forwarded_to}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = blank({
        campaignId: row.geo_campaign_id as string,
        domain: row.custom_domain,
        phone: row.forwarded_to,
      });
      byKey.set(key, entry);
    }
    tally(entry, row);
  }
  return { rows: [...byKey.values()], unattributed };
}

/** The same tally rolled up per destination, across every campaign that dials it. */
export async function loadDestinationHealth(
  opts: { sinceDays?: number } = {},
): Promise<DestinationHealth[]> {
  const { rows } = await loadCampaignForwardHealth(opts);
  const byPhone = new Map<string, DestinationHealth>();
  for (const r of rows) {
    let e = byPhone.get(r.phone);
    if (!e) {
      e = { phone: r.phone, answered: 0, brief: 0, unanswered: 0, inProgress: 0, lastAnsweredAt: null, lastCallAt: null, domains: [] };
      byPhone.set(r.phone, e);
    }
    e.answered += r.answered;
    e.brief += r.brief;
    e.unanswered += r.unanswered;
    e.inProgress += r.inProgress;
    if (r.lastCallAt && (!e.lastCallAt || r.lastCallAt > e.lastCallAt)) e.lastCallAt = r.lastCallAt;
    if (r.lastAnsweredAt && (!e.lastAnsweredAt || r.lastAnsweredAt > e.lastAnsweredAt)) {
      e.lastAnsweredAt = r.lastAnsweredAt;
    }
    if (r.domain && !e.domains.includes(r.domain)) e.domains.push(r.domain);
  }
  return [...byPhone.values()];
}

/**
 * Does this destination's record warrant being called unresponsive?
 *
 * ⚠️ PURE, AND DELIBERATELY HARDER TO SATISFY THAN IT FEELS. The cost of a false positive is
 * dropping the best business in a market on a bad morning; the cost of a false negative is the
 * operator noticing a week later, which is what already happens. So it needs a real run of
 * failures AND nothing that looks like a working line — one answered call, ever, clears it.
 *
 * It is a SUGGESTION, never an automatic write. `markUnresponsive` is called by a person or by a
 * job that reports; nothing in the recommender flips this on by itself, because "they did not
 * answer our unknown caller ID" is a conclusion about them drawn from evidence about us.
 */
export function suggestsUnresponsive(h: {
  answered: number | null;
  brief?: number | null;
  unanswered: number | null;
}): boolean {
  // ⚠️ NULL IS NOT ZERO, AND READING IT AS ZERO IS THE TRAP THIS GUARDS. A row whose counts are
  // unattributable (calls predating `call_logs.forwarded_to`) carries its evidence in the note,
  // not in the numbers. Treating those NULLs as zeros would make this return false and quietly
  // recommend clearing a correct entry — the first real row, AL Ram Towing, was exactly that
  // case. No data means no automated opinion, never "no failures".
  if (h.unanswered === null || h.unanswered === undefined) return false;
  if (h.answered === null || h.answered === undefined) return false;
  if (h.answered > 0) return false;
  return h.unanswered >= 3;
}

export type UnresponsiveRow = {
  phone: string;
  first_observed_at: string;
  last_observed_at: string;
  unanswered_calls: number | null;
  answered_calls: number | null;
  source: string;
  note: string | null;
  cleared_at: string | null;
};

/** Active (uncleared) unresponsive destinations, as a phone set for the recommender. */
export async function loadUnresponsivePhones(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('forward_unresponsive')
    .select('phone')
    .is('cleared_at', null);
  const out = new Set<string>();
  for (const r of data ?? []) {
    const d = String((r as { phone: string }).phone ?? '').replace(/\D+/g, '');
    const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
    if (n) out.add(n);
  }
  return out;
}

/**
 * Record that a destination does not answer.
 *
 * Upsert rather than insert: observing it again updates the evidence and REOPENS a cleared row,
 * because "we gave them another chance and it failed again" is the case the history exists for.
 */
export async function markUnresponsive(
  phone: string,
  opts: {
    /** Attributed counts, or null/omitted when none could be attributed — never 0 for unknown. */
    unanswered?: number | null;
    answered?: number | null;
    source?: 'operator' | 'call_outcomes';
    note?: string | null;
  } = {},
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from('forward_unresponsive')
    .select('phone, first_observed_at')
    .eq('phone', phone)
    .maybeSingle();
  await supabaseAdmin.from('forward_unresponsive').upsert(
    {
      phone,
      first_observed_at: (existing as { first_observed_at?: string } | null)?.first_observed_at ?? now,
      last_observed_at: now,
      // ⚠️ `?? null`, never `?? 0`. An absent count means we could not attribute any calls to
      // this destination; a zero would claim we looked and found none.
      unanswered_calls: opts.unanswered ?? null,
      answered_calls: opts.answered ?? null,
      source: opts.source ?? 'operator',
      note: opts.note ?? null,
      cleared_at: null,
      cleared_reason: null,
    },
    { onConflict: 'phone' },
  );
}

/** Give a destination another chance. The row stays, so the history survives. */
export async function clearUnresponsive(phone: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from('forward_unresponsive')
    .update({ cleared_at: new Date().toISOString(), cleared_reason: reason })
    .eq('phone', phone);
}
