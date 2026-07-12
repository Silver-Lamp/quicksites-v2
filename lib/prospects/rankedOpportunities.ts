// lib/prospects/rankedOpportunities.ts
//
// Pure "work the warmest assets first" ranking for the prospects funnel. Fuses GSC rank
// (how well a geo-campaign's pitch page already ranks) with unlockable rent (industry tier)
// and local demand (competing no-website businesses) into one prioritized worklist.
//
// Grounding: each geo-campaign pitch site is a one-page site whose apex == the page, so a
// domain-level GSC position ≈ the page's position. See docs/RANKED_TARGETING_PLAN.md.
//
// Pure + self-typed (no I/O), mirroring lib/prospects/territoryScore.ts so it unit-tests in
// isolation. The route/UI feeds it rows and the already-fetched gscByDomain map.

import type { IndustryKey } from '@/lib/industries';
import { priceTier, deriveRankStatus, type RankStatus } from '@/lib/outreach/geoPricing';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';

// ── Inputs ──────────────────────────────────────────────────────────────────

/** 28-day GSC totals for a domain (from /api/gsc/summary → gscByDomain). */
export type GscStat = { clicks: number; impressions: number; position: number };

/** The minimum a campaign row must carry. Maps onto GeoCampaign / geo_industry_campaigns. */
export type OpportunityCampaign = {
  id: string;
  domain: string;
  city: string;
  region?: string | null;
  industry_key: string;
  template_id?: string | null;
  status?: string | null;
};

/** The minimum a prospect row must carry (for the competitor tally). */
export type OpportunityProspect = {
  geo_campaign_id?: string | null;
  status?: string | null;
  lead_tier?: string | null;
};

export type RankedOpportunityOptions = {
  /** Cap on how much the competitor count can boost the score (demand, sub-linear). */
  maxDemandCompetitors?: number;
};

// ── Outputs ─────────────────────────────────────────────────────────────────

export type RankedOpportunity = {
  campaignId: string;
  domain: string;
  city: string;
  region: string | null;
  industryKey: string;
  templateId: string | null;
  /** GSC stats for the domain, or null when the domain isn't connected to GSC yet. */
  gsc: GscStat | null;
  /** True when we have a GSC token/data for the domain (vs. "not connected yet"). */
  connected: boolean;
  rankStatus: RankStatus;
  /** 0..1 quality weight: page1 1.0 · ranking(11–20) 0.6 · ranking(impr) 0.35 · unranked 0.1. */
  rankQuality: number;
  /** Full monthly rent for the industry tier, in cents (the "$/mo unlockable"). */
  monthlyRentCents: number;
  /** Competing no-website businesses tied to this campaign (demand / urgency). */
  competitors: number;
  /** rankQuality × rent × demand — the sort key. Higher = work sooner. */
  score: number;
};

const DEFAULT_MAX_DEMAND_COMPETITORS = 10;

/** GSC bucket → quality weight. Unranked isn't zero: a fresh geo-domain is still work. */
export function rankQualityFor(status: RankStatus, position: number): number {
  if (status === 'page1') return 1.0;
  if (status === 'ranking') return position > 0 && position <= 20 ? 0.6 : 0.35;
  return 0.1;
}

/**
 * Build the prioritized worklist. Joins campaigns → gscByDomain (rank) and → prospects
 * (competitor tally), scores each, and returns them sorted hottest-first.
 */
export function buildRankedOpportunities(
  campaigns: OpportunityCampaign[],
  prospects: OpportunityProspect[],
  gscByDomain: Record<string, GscStat> | undefined,
  opts: RankedOpportunityOptions = {},
): RankedOpportunity[] {
  const maxDemand = opts.maxDemandCompetitors ?? DEFAULT_MAX_DEMAND_COMPETITORS;

  // Competitor tally per campaign: linked, non-dismissed, no-website businesses.
  const competitorsByCampaign = new Map<string, number>();
  for (const p of prospects) {
    if (!p.geo_campaign_id || p.status === 'dismissed') continue;
    if (p.lead_tier !== 'no_website') continue;
    competitorsByCampaign.set(p.geo_campaign_id, (competitorsByCampaign.get(p.geo_campaign_id) ?? 0) + 1);
  }

  const out: RankedOpportunity[] = campaigns
    .filter((c) => c.status !== 'archived')
    .map((c) => {
      const key = normalizeGscDomain(c.domain);
      const gsc = (key && gscByDomain?.[key]) || null;
      const connected = !!gsc;
      const position = gsc?.position ?? 0;
      const impressions = gsc?.impressions ?? 0;
      const rankStatus = deriveRankStatus(position, impressions);
      const rankQuality = rankQualityFor(rankStatus, position);
      const monthlyRentCents = priceTier(c.industry_key as IndustryKey).fullCents;
      const competitors = competitorsByCampaign.get(c.id) ?? 0;
      // Demand: mild, capped, sub-linear boost — the domain rents to ONE winner, but more
      // competing businesses means a claim is likelier + more churn backfill.
      const demandFactor = 1 + 0.1 * Math.min(competitors, maxDemand);
      const score = rankQuality * monthlyRentCents * demandFactor;
      return {
        campaignId: c.id,
        domain: c.domain,
        city: c.city,
        region: c.region ?? null,
        industryKey: c.industry_key,
        templateId: c.template_id ?? null,
        gsc,
        connected,
        rankStatus,
        rankQuality,
        monthlyRentCents,
        competitors,
        score,
      };
    });

  // Hottest first; break ties by better position, then more competitors.
  return out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ap = a.gsc?.position || Infinity;
    const bp = b.gsc?.position || Infinity;
    if (ap !== bp) return ap - bp;
    return b.competitors - a.competitors;
  });
}
