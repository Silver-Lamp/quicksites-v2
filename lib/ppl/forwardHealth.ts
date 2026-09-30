// lib/ppl/forwardHealth.ts
//
// IS THE FORWARD-TO ACTUALLY PICKING UP?
//
// A tracking number that rings a business nobody answers is worse than one that rings nowhere:
// the caller waits through "please hold while we connect you" before giving up, and every
// dashboard reads a call as delivered. covingtontow.com dropped two real leads that way on
// 2026-09-30 and it was found by the operator dialling his own site.
//
// ⚠️ THIS FILE CANNOT TELL YOU A PERSON ANSWERED, AND IT USED TO CLAIM IT COULD.
//
// The outcome was called `answered` and meant "Twilio said completed and the leg lasted ≥15s".
// The 15 was reasoned from when a voicemail GREETING STARTS — a second or two — which is the
// wrong quantity: the leg does not end at the greeting, it lasts as long as the message the
// caller leaves. On 2026-09-30 the operator rang covingtontow.com, was bridged into Prime
// Towing's voicemail, left a message, and the leg ran **20 seconds**. It was filed as
// `answered`, our own voicemail fallback never fired, and the business was never texted.
//
// **Duration cannot separate a person from a voicemail the caller talked to.** No threshold
// can: the two produce identical rows. So the outcome is now `connected` — the leg lasted long
// enough to be a conversation *or* a message left on the destination's machine — and the name
// no longer asserts the thing we cannot see.
//
// ⚠️ THE ONLY RELIABLE "A HUMAN TOOK THIS CALL" SIGNAL IS `cascade_attempts.accepted`, written
// by a keypress a voicemail cannot press (docs/CALL_CASCADE_PLAN.md §3). Anything derived from
// `DialCallStatus` is a guess wearing a number. If you need to know whether a person answered,
// read that column; do not add a cleverer threshold here.
//
// ⚠️ ONLY ROWS THAT RECORD THEIR OWN DESTINATION COUNT. `call_logs.forwarded_to` is written at
// dial time (20260861); rows predating it are NULL and are reported as `unattributed` rather
// than assigned to whoever holds the line today. A re-point must not inherit the previous
// destination's failures — that is the same wrong-instance error as measuring the marketing
// pages and concluding the tenant sites were fine.
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Seconds a bridged leg must last before we call it `connected` rather than `brief`.
 *
 * ⚠️ IT SEPARATES "SOMETHING ANSWERED AND THE CALL WENT ON" FROM "SOMETHING ANSWERED AND IT WAS
 * OVER IN SECONDS" — nothing more. It does NOT identify a human, and the first version of this
 * comment claimed it did. Below it sits the 3-second SIT-tone case (Prime Towing, same day);
 * above it sits both a real conversation and a 20-second voicemail message, which this module
 * has no way to tell apart.
 *
 * The PPL biller's 90s is a different and stricter question (is this a BILLABLE lead), and it
 * has the same blind spot.
 */
export const CONNECTED_MIN_SECONDS = 15;

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

export type DialOutcome = 'connected' | 'brief' | 'unanswered' | 'in_progress';

export function classifyDial(status: string | null, durationSec: number | null): DialOutcome {
  const s = (status ?? '').trim().toLowerCase();
  if (UNANSWERED_STATUSES.has(s)) return 'unanswered';
  // ⚠️ These are TWILIO'S status strings and are not ours to rename. A bulk rename of the
  // outcome word turned `'answered'` — a value Twilio can actually send — into `'connected'`,
  // a string it never sends, which would have silently reclassified those legs as
  // `in_progress`. An input vocabulary and an output vocabulary that share a word are not the
  // same vocabulary.
  if (s === 'dial-completed' || s === 'completed' || s === 'answered' || s === 'dial-answered') {
    return (durationSec ?? 0) >= CONNECTED_MIN_SECONDS ? 'connected' : 'brief';
  }
  // 'ringing', 'initiated', 'in-progress' and anything unrecognised. Deliberately NOT counted as
  // a failure: an unknown status is missing information, and inventing a verdict from it would
  // put a business on the unresponsive list for a vocabulary change at Twilio.
  return 'in_progress';
}

export type DestinationHealth = {
  phone: string;
  connected: number;
  brief: number;
  unanswered: number;
  inProgress: number;
  lastConnectedAt: string | null;
  lastCallAt: string | null;
  /** Campaign domains that have dialled this number. */
  domains: string[];
};

export type CampaignForwardHealth = {
  campaignId: string;
  domain: string | null;
  /** The destination these counts belong to — the one on the CALL rows, not the campaign. */
  phone: string;
  connected: number;
  brief: number;
  unanswered: number;
  inProgress: number;
  lastConnectedAt: string | null;
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
  return { connected: 0, brief: 0, unanswered: 0, inProgress: 0, lastConnectedAt: null as string | null, lastCallAt: null as string | null, ...base };
}

function tally(acc: { connected: number; brief: number; unanswered: number; inProgress: number; lastConnectedAt: string | null; lastCallAt: string | null }, row: CallRow) {
  const outcome = classifyDial(row.call_status, row.call_duration);
  if (outcome === 'connected') acc.connected += 1;
  else if (outcome === 'brief') acc.brief += 1;
  else if (outcome === 'unanswered') acc.unanswered += 1;
  else acc.inProgress += 1;

  const ts = row.timestamp;
  if (ts) {
    if (!acc.lastCallAt || ts > acc.lastCallAt) acc.lastCallAt = ts;
    if (outcome === 'connected' && (!acc.lastConnectedAt || ts > acc.lastConnectedAt)) {
      acc.lastConnectedAt = ts;
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
      e = { phone: r.phone, connected: 0, brief: 0, unanswered: 0, inProgress: 0, lastConnectedAt: null, lastCallAt: null, domains: [] };
      byPhone.set(r.phone, e);
    }
    e.connected += r.connected;
    e.brief += r.brief;
    e.unanswered += r.unanswered;
    e.inProgress += r.inProgress;
    if (r.lastCallAt && (!e.lastCallAt || r.lastCallAt > e.lastCallAt)) e.lastCallAt = r.lastCallAt;
    if (r.lastConnectedAt && (!e.lastConnectedAt || r.lastConnectedAt > e.lastConnectedAt)) {
      e.lastConnectedAt = r.lastConnectedAt;
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
 * failures AND nothing that looks like a working line — one connected call, ever, clears it.
 *
 * It is a SUGGESTION, never an automatic write. `markUnresponsive` is called by a person or by a
 * job that reports; nothing in the recommender flips this on by itself, because "they did not
 * answer our unknown caller ID" is a conclusion about them drawn from evidence about us.
 */
export function suggestsUnresponsive(h: {
  connected: number | null;
  brief?: number | null;
  unanswered: number | null;
}): boolean {
  // ⚠️ NULL IS NOT ZERO, AND READING IT AS ZERO IS THE TRAP THIS GUARDS. A row whose counts are
  // unattributable (calls predating `call_logs.forwarded_to`) carries its evidence in the note,
  // not in the numbers. Treating those NULLs as zeros would make this return false and quietly
  // recommend clearing a correct entry — the first real row, AL Ram Towing, was exactly that
  // case. No data means no automated opinion, never "no failures".
  if (h.unanswered === null || h.unanswered === undefined) return false;
  if (h.connected === null || h.connected === undefined) return false;
  if (h.connected > 0) return false;
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
    connected?: number | null;
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
      answered_calls: opts.connected ?? null,
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
