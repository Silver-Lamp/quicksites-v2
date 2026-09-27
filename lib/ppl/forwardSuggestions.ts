// lib/ppl/forwardSuggestions.ts
//
// The thin I/O around `forwardCandidates.ts`: load the campaigns that have no forward-to, the
// prospects that could be one, and who has already said STOP — then let the pure module decide.
// All the judgement lives there; this file only fetches.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import {
  recommendForwardTargets,
  normalizePhone,
  type ForwardCampaign,
  type ForwardProspect,
  type ForwardRecommendation,
} from './forwardCandidates';

const PROSPECT_COLUMNS =
  'id, business_name, phone, website, city, region, industry_key, rating, review_count, status, created_at, last_seen_at';

/** A campaign needs this much real search demand before it is worth wiring to a business. */
const MIN_IMPRESSIONS = 10;

/**
 * Recommend a forward-to for every campaign that lacks one and has earned one.
 *
 * ⚠️ SCOPED BY SEARCH DEMAND, NOT BY HAVING A NUMBER — and the obvious gate is backwards.
 * `provision-number` takes `{ campaignId, forwardTo }`, so the forward-to is an INPUT to buying
 * the number; requiring a number first would hide the suggestion for exactly the campaigns that
 * need one. All 129 campaigns are `status='draft'` and only one holds a number, so gating on
 * either would surface nothing.
 *
 * ⚠️ AND NOT BY `rank_status` EITHER, which reads `unranked` for all three markets this was
 * built for. `unranked` means the rank sync never wrote a rank, not that the domain does not
 * rank — the proven list came from the GSC query harvest. Filtering on `page1` would have
 * excluded precisely the campaigns in question while looking like a principled filter.
 */
export async function suggestForwardTargets(opts: { requireDemand?: boolean } = {}): Promise<{
  recommendations: ForwardRecommendation[];
  skipped: { domain: string; why: string }[];
}> {
  const { data: campaigns } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, city, region, industry_key, forward_to, tracking_number, forward_opted_out_at')
    .is('forward_to', null)
    .order('domain');

  // Impressions per campaign domain. GSC stores a property (`sc-domain:x`, `https://www.x/`),
  // so both sides go through the same normalizer rather than comparing raw strings.
  const demand = new Map<string, number>();
  if (opts.requireDemand !== false) {
    const { data: gsc } = await supabaseAdmin.from('gsc_queries').select('domain, impressions');
    for (const g of gsc ?? []) {
      const key = normalizeGscDomain(g.domain);
      if (key) demand.set(key, (demand.get(key) ?? 0) + (g.impressions ?? 0));
    }
  }

  const rows = campaigns ?? [];
  const skipped: { domain: string; why: string }[] = [];
  const eligible: ForwardCampaign[] = [];

  for (const c of rows) {
    if (c.forward_opted_out_at) {
      skipped.push({ domain: c.domain, why: 'the business opted out of forwarding' });
      continue;
    }
    if (!c.city || !c.industry_key) {
      skipped.push({ domain: c.domain, why: 'campaign has no city or industry to match on' });
      continue;
    }
    if (opts.requireDemand !== false && !c.tracking_number) {
      const imp = demand.get(normalizeGscDomain(c.domain)) ?? 0;
      if (imp < MIN_IMPRESSIONS) {
        skipped.push({ domain: c.domain, why: `only ${imp} search impressions — no demand to route yet` });
        continue;
      }
    }
    eligible.push({
      id: c.id,
      domain: c.domain,
      city: c.city,
      region: c.region,
      industry_key: c.industry_key,
    });
  }

  if (eligible.length === 0) return { recommendations: [], skipped };

  const cities = [...new Set(eligible.map((c) => c.city).filter(Boolean) as string[])];
  const industries = [...new Set(eligible.map((c) => c.industry_key).filter(Boolean) as string[])];

  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select(PROSPECT_COLUMNS)
    .in('city', cities)
    .in('industry_key', industries);

  // Two opt-out surfaces, and both have to be honoured: the global phone list written by the
  // STOP handler, and a per-campaign stamp. A phone on either list is not a candidate anywhere.
  const { data: optOutRows } = await supabaseAdmin.from('forward_opt_outs').select('phone');
  const optedOut = new Set((optOutRows ?? []).map((r) => normalizePhone(r.phone)).filter(Boolean));

  const { data: taken } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('domain, forward_to')
    .not('forward_to', 'is', null);
  const forwardedElsewhere = new Map<string, string>();
  for (const t of taken ?? []) {
    const n = normalizePhone(t.forward_to);
    if (n) forwardedElsewhere.set(n, t.domain);
  }

  const all = (prospects ?? []) as ForwardProspect[];
  // ⚠️ Narrow by TRADE here, but leave the city match to the module. Passing every prospect in
  // the city made `disqualified` a wall of restaurants and electricians — a different trade is
  // not a rejected candidate, it is an unrelated row, and burying the real rejections in it is
  // how a report stops being read. City stays in the module because it needs the service-area
  // normalisation ("Serving Renton, WA") that a SQL equality cannot do.
  const recommendations = eligible.map((c) =>
    recommendForwardTargets(
      c,
      all.filter((p) => p.industry_key === c.industry_key),
      { optedOut, forwardedElsewhere },
    ),
  );

  return { recommendations, skipped };
}
