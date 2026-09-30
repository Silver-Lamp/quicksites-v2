// lib/ppl/forwardSuggestions.ts
//
// The thin I/O around `forwardCandidates.ts`: load the campaigns that have no forward-to, the
// prospects that could be one, and who has already said STOP — then let the pure module decide.
// All the judgement lives there; this file only fetches.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import {
  recommendForwardTargets,
  deconflictTopPicks,
  normalizePhone,
  type ForwardCampaign,
  type ForwardProspect,
  type ForwardRecommendation,
} from './forwardCandidates';
import { loadUnresponsivePhones } from './forwardHealth';

const PROSPECT_COLUMNS =
  'id, business_name, phone, website, city, region, industry_key, rating, review_count, status, created_at, last_seen_at, address_lat, address_lon';

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
export async function suggestForwardTargets(
  opts: { requireDemand?: boolean; includeAssigned?: boolean } = {},
): Promise<{
  recommendations: ForwardRecommendation[];
  skipped: { domain: string; why: string }[];
}> {
  // ⚠️ `includeAssigned` exists because "who should this go to instead" had no answer. The
  // `.is('forward_to', null)` filter meant a campaign was ranked exactly once — before it had a
  // destination — and never again, so the re-point box on /admin/ppl opened empty and the
  // operator had to type an E.164 number from memory. On 2026-09-30 that produced a format
  // error on an untouched field whose placeholder looked like a value. A recommender that
  // cannot answer the question being asked at the moment it is asked is not much of one.
  const query = supabaseAdmin
    .from('geo_industry_campaigns')
    .select(
      'id, domain, city, region, industry_key, center_lat, center_lon, forward_to, tracking_number, forward_opted_out_at, forward_notice_sent_to',
    )
    .order('domain');
  const { data: campaigns } = await (opts.includeAssigned ? query : query.is('forward_to', null));

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
    // ⚠️ A CLEARED DESTINATION IS A DECISION, NOT A GAP — and without this the UI invites
    // someone to undo it. Voicemail-first is switched on by clearing `forward_to`
    // (docs/CALL_CASCADE_PLAN.md §13), which makes the campaign look exactly like one that
    // never had a destination, so it reappears under "Suggested forward-to" with a pick and an
    // attach button. A week from now that reads as a to-do, someone attaches a business, and
    // the experiment ends silently with nothing recording that it did.
    //
    // Told apart without a second flag: `forward_notice_sent_to` is only ever written when a
    // destination WAS set, so notice-sent plus no-destination means it was cleared on purpose.
    // A STOP also clears `forward_to`, but stamps `forward_opted_out_at` and is skipped above.
    if (!c.forward_to && c.forward_notice_sent_to) {
      skipped.push({
        domain: c.domain,
        why: 'voicemail-first — destination deliberately cleared; re-attach from the campaigns table if that is wrong',
      });
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
      center_lat: c.center_lat,
      center_lon: c.center_lon,
      current_forward_to: c.forward_to ?? null,
    });
  }

  if (eligible.length === 0) return { recommendations: [], skipped };

  const industries = [...new Set(eligible.map((c) => c.industry_key).filter(Boolean) as string[])];

  // ⚠️ NO `.in('city', …)` FILTER ANY MORE. It was the SQL half of the same mistake the module
  // just stopped making: pre-filtering on the city name discards exactly the businesses the
  // distance match exists to find — the twelve Maple Valley tow companies parked under "Renton"
  // would never reach the matcher to be measured. Narrow by trade only; let the module decide
  // what is in the market.
  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select(PROSPECT_COLUMNS)
    .in('industry_key', industries);

  // Two opt-out surfaces, and both have to be honoured: the global phone list written by the
  // STOP handler, and a per-campaign stamp. A phone on either list is not a candidate anywhere.
  const { data: optOutRows } = await supabaseAdmin.from('forward_opt_outs').select('phone');
  const optedOut = new Set((optOutRows ?? []).map((r) => normalizePhone(r.phone)).filter(Boolean));

  // A third exclusion, and the one that is our observation rather than the business's decision:
  // destinations seen not answering forwarded calls. Without it the recommender re-picks the
  // highest-scoring business in the market every time, which is exactly the one just dropped for
  // not picking up — AL Ram Towing scored 68 in Covington on the morning its third call rang out.
  const unresponsive = await loadUnresponsivePhones();

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
  const recommendations = eligible.map((c) => {
    // ⚠️ A campaign's OWN destination must not read as "taken by another campaign". The map is
    // built globally, so without this a re-point would show the incumbent flagged
    // `already receives forwarded calls from <its own domain>` and penalised 50 points for it —
    // a warning about a conflict with itself.
    const self = normalizePhone(c.current_forward_to);
    const others = self
      ? new Map([...forwardedElsewhere].filter(([phone]) => phone !== self))
      : forwardedElsewhere;
    return recommendForwardTargets(
      c,
      all.filter((p) => p.industry_key === c.industry_key),
      {
        optedOut,
        unresponsive,
        forwardedElsewhere: others,
        currentDestination: c.current_forward_to ?? null,
      },
    );
  });

  // ⚠️ Deconflict AFTER ranking: distance matching makes neighbouring markets overlap, and
  // without this one business is the top pick for four campaigns at once.
  //
  // ⚠️ BUT ONLY OVER CAMPAIGNS THAT ARE ACTUALLY BEING ASSIGNED ONE. Deconfliction reserves a
  // business for the campaign whose town it is closest to; a campaign that already forwards
  // somewhere is not competing for anybody, so letting it into the pass makes it hoard a
  // candidate for a re-point that will never happen.
  //
  // This is not hypothetical — it appeared the moment `includeAssigned` was added. Covington,
  // the one campaign genuinely needing a new destination, lost Prime Towing (5.0★/10, fresh),
  // Hook Towing and Affordable Towing Issaquah to seatac / renton / maplevalley — all three of
  // which have working forward-tos — and fell through to King's Towing: unrated and last
  // observed 79 days ago. A live destination is not a claim on the market's next best business.
  //
  // Real assignments are still respected everywhere: `forwardedElsewhere` is built from every
  // campaign that actually forwards, so an assigned business is already penalised and flagged
  // for everyone. Deconfliction covers only the different case of two FRESH picks colliding.
  const unassigned = recommendations.filter((r) => !r.campaign.current_forward_to);
  const assigned = recommendations.filter((r) => !!r.campaign.current_forward_to);
  return { recommendations: [...deconflictTopPicks(unassigned), ...assigned], skipped };
}
