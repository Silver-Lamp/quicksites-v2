// lib/ppl/cascadeStore.ts
//
// The I/O around `lib/ppl/cascade.ts`: load a market's pool, read what has been tried on this
// call, record each attempt and each acceptance. All judgement lives in the pure module.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { marketMatch, normalizePhone, type ForwardProspect } from './forwardCandidates';
import { loadDestinationHealth, loadUnresponsivePhones } from './forwardHealth';
import { usE164 } from '@/lib/phone/formatUs';
import type { CascadeAttempt, CascadeCandidate } from './cascade';

/**
 * Every business in the campaign's market that we could ring.
 *
 * ⚠️ OPT-OUTS ARE HONOURED, UNRESPONSIVE ONES ARE NOT EXCLUDED. A STOP is the business's own
 * decision and is absolute. "Does not answer" is our observation, and in a cascade it belongs in
 * the ORDER rather than the filter — ringing a business that has never picked up costs 22
 * seconds and might work; striking it off permanently shrinks a thin market for good. This is
 * the same data doing a better job than it did as a blacklist.
 */
export async function loadCascadePool(campaignId: string): Promise<CascadeCandidate[]> {
  // ⚠️ IT LOADS THE CAMPAIGN ITSELF RATHER THAN TAKING ONE, BECAUSE THE OBVIOUS CALLER HANDS
  // OVER THE WRONG SHAPE. `getGeoCampaign()` is the natural thing to pass, and its column list
  // (`GEO_COLS`) does NOT include `center_lat`/`center_lon` — so `marketMatch` would find no
  // coordinates and fall back to city-NAME equality for every call. That fallback is the exact
  // bug distance matching was built to kill: `outreach_prospects.city` records where a business
  // was first swept, not which town it serves, and it qualified 1 of 13 real candidates in Maple
  // Valley. The cascade would have rung one business in a market that has thirty-three, and
  // nothing would have looked broken.
  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, industry_key, center_lat, center_lon')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign?.industry_key) return [];

  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select(
      'id, business_name, phone, website, city, region, industry_key, rating, review_count, status, created_at, last_seen_at, address_lat, address_lon, closed_at',
    )
    .eq('industry_key', campaign.industry_key)
    .is('closed_at', null);

  const { data: optOutRows } = await supabaseAdmin.from('forward_opt_outs').select('phone');
  const optedOut = new Set((optOutRows ?? []).map((r) => normalizePhone(r.phone)).filter(Boolean));

  // Answer history per destination, so `orderCascade` can put the ones that pick up first.
  const health = await loadDestinationHealth({ sinceDays: 180 }).catch(() => []);
  const byPhone = new Map(health.map((h) => [normalizePhone(h.phone), h]));

  // Kept only to annotate: an unresponsive row with no attributed calls still means someone
  // looked at this business and concluded it does not answer, which should sink it in the order
  // even when `forwardHealth` has no countable rows for it.
  const unresponsive = await loadUnresponsivePhones().catch(() => new Set<string>());

  const out: CascadeCandidate[] = [];
  const seen = new Set<string>();
  for (const p of (prospects ?? []) as ForwardProspect[]) {
    const e164 = usE164(p.phone);
    if (!e164) continue;
    const key = normalizePhone(e164);
    if (optedOut.has(key) || seen.has(key)) continue;
    if (!marketMatch(p, campaign as never).inMarket) continue;
    seen.add(key);
    const h = byPhone.get(key);
    out.push({
      prospectId: p.id,
      businessName: p.business_name,
      phone: e164,
      answered: h ? h.answered : null,
      // An operator-marked unresponsive destination with no countable history still sorts last.
      unanswered: h ? h.unanswered : unresponsive.has(key) ? 1 : null,
    });
  }
  return out;
}

/** What has already been rung on this call, oldest first. */
export async function loadAttempts(callSid: string): Promise<CascadeAttempt[]> {
  const { data } = await supabaseAdmin
    .from('cascade_attempts')
    .select('phone, accepted, attempt')
    .eq('call_sid', callSid)
    .order('attempt', { ascending: true });
  return ((data ?? []) as { phone: string; accepted: boolean }[]).map((r) => ({
    phone: r.phone,
    accepted: r.accepted,
  }));
}

/**
 * Record that we are about to ring someone.
 *
 * ⚠️ Returns false when the row already exists. The unique index on (call_sid, attempt) means a
 * Twilio webhook retry loses the race instead of inserting a duplicate — and a duplicate would
 * make the caller skip a business while the counter advanced. The caller reads false as "this
 * step already happened", never as an error.
 */
export async function recordAttempt(row: {
  callSid: string;
  campaignId: string;
  attempt: number;
  candidate: CascadeCandidate;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from('cascade_attempts').insert({
    call_sid: row.callSid,
    campaign_id: row.campaignId,
    attempt: row.attempt,
    phone: row.candidate.phone,
    prospect_id: row.candidate.prospectId,
    business_name: row.candidate.businessName,
  });
  return !error;
}

export async function recordAttemptOutcome(
  callSid: string,
  attempt: number,
  outcome: { dialStatus: string | null; durationSec: number | null },
): Promise<void> {
  await supabaseAdmin
    .from('cascade_attempts')
    .update({ dial_status: outcome.dialStatus, dial_duration_sec: outcome.durationSec })
    .eq('call_sid', callSid)
    .eq('attempt', attempt);
}

/** The business pressed 1. The only thing that may set this. */
export async function recordAcceptance(callSid: string, attempt: number): Promise<void> {
  await supabaseAdmin
    .from('cascade_attempts')
    .update({ accepted: true, accepted_at: new Date().toISOString() })
    .eq('call_sid', callSid)
    .eq('attempt', attempt);
}

export async function attemptPhone(callSid: string, attempt: number): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('cascade_attempts')
    .select('phone')
    .eq('call_sid', callSid)
    .eq('attempt', attempt)
    .maybeSingle();
  return (data as { phone: string } | null)?.phone ?? null;
}
