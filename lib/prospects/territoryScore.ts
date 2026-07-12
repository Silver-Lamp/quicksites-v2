// lib/prospects/territoryScore.ts
//
// Pure "which area do we target next?" scoring. Sits UPSTREAM of the discover→build→
// geo-campaign funnel: given prospects we've swept (or cheaply sampled), it buckets them
// into spatial cells and scores each cell by the thing that actually makes us money —
// how many rentable geo-domain "competition cards" it contains, weighted by industry rent
// value, minus saturation.
//
// Design notes:
//  - Pure + self-typed (no I/O, no supabase), mirroring lib/outreach/recommendations.ts so
//    it unit-tests in isolation. The route layer feeds it rows and persists the output.
//  - A "competition card" = a (cell × industry) with >= MIN_CLUSTER no-website businesses.
//    That's the geo-domain land-grab unit (see businesses-near-me + GEO_DOMAIN_MONETIZATION).
//  - Industry lead-value reuses priceTier() from geoPricing, so a cell's headline number is
//    literally "estimated monthly rent unlockable here", not an abstract score.

import type { IndustryKey } from '@/lib/industries';
import { priceTier } from '@/lib/outreach/geoPricing';

// ── Inputs ──────────────────────────────────────────────────────────────────

/** The minimum a prospect row must carry for scoring. Maps onto outreach_prospects. */
export type ScorableProspect = {
  address_lat: number | null;
  address_lon: number | null;
  city: string | null;
  region: string | null;
  industry_key: string | null;
  lead_tier: 'no_website' | 'dated' | 'has_site' | string | null;
  review_count?: number | null; // busyness / order-volume proxy (Place Details, when synced)
  rating?: number | null;
  geo_campaign_id?: string | null; // links a prospect to a launched geo-domain campaign
};

export type TerritoryScoreOptions = {
  /** Cell size in degrees when bucketing by lat/lon grid (~0.02° ≈ 1.5km). */
  cellDegrees?: number;
  /** How to bucket a prospect into a cell. Default: coarse lat/lon grid.
   *  Pass a city-keyer for coarse mode, or an H3/geohash keyer later. */
  cellKey?: (p: ScorableProspect) => string | null;
  /** Min no-website businesses in one (cell × industry) to count as a competition card. */
  minCluster?: number;
  /** A `dated` site is a weaker lead than `no_website`; its fractional weight. */
  datedWeight?: number;
  /**
   * campaignId → rank quality (0..1) for campaigns whose pitch page already ranks. A cell
   * containing a prospect tied to such a campaign gets a score boost — double down on ground
   * we already rank. Caller supplies quality (e.g. page1 1.0 · ranking 0.6). See
   * lib/prospects/rankedOpportunities.ts#rankQualityFor.
   */
  rankByCampaign?: Record<string, number>;
  /** How much a fully-ranked cell (quality 1.0) multiplies its composite. Default 0.35 (+35%). */
  rankBoostWeight?: number;
};

// ── Outputs ─────────────────────────────────────────────────────────────────

export type IndustryCluster = {
  industry: string;
  noWebsite: number;
  dated: number;
  hasSite: number;
  /** True when this is a rentable competition card (noWebsite >= minCluster). */
  landGrabViable: boolean;
  /** Full monthly rent for this industry tier, in cents (0 for unknown industries). */
  rentValueCents: number;
};

export type TerritoryScore = {
  cell: string;
  label: string; // human label, e.g. "Boston, MA" or a lat/lon centroid
  centroid: { lat: number; lon: number };
  count: number;
  addressable: number; // no_website + datedWeight*dated
  saturation: number; // hasSite / count, 0..1
  demandProxy: number; // sum of log1p(review_count)
  clusters: IndustryCluster[];
  viableCards: number; // # of landGrabViable clusters
  /** Sum of rent from viable cards — the headline "unlockable $/mo" for this cell. */
  estMonthlyRentCents: number;
  /** Normalized 0..100 composite for ranking. */
  score: number;
  /** Best rank quality (0..1) of any campaign we already rank in this cell (0 = none). */
  rankedQuality: number;
  /** Raw signal bag so an LLM re-rank (synthesizeTopThree-style) and the UI can explain it. */
  rationale: {
    topIndustry: string | null;
    noWebsite: number;
    dated: number;
    hasSite: number;
    /** True when we already rank a pitch page in this cell — "double down here". */
    rankedHere: boolean;
  };
};

// ── Cell bucketing ──────────────────────────────────────────────────────────

const DEFAULTS = { cellDegrees: 0.02, minCluster: 2, datedWeight: 0.4 } as const;

function gridCellKey(cellDegrees: number) {
  return (p: ScorableProspect): string | null => {
    if (p.address_lat == null || p.address_lon == null) return null;
    const gy = Math.round(p.address_lat / cellDegrees) * cellDegrees;
    const gx = Math.round(p.address_lon / cellDegrees) * cellDegrees;
    return `${gy.toFixed(4)},${gx.toFixed(4)}`;
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function industryRentCents(industry: string | null): number {
  if (!industry) return 0;
  // priceTier keys off IndustryKey; unknown strings fall through to the LOW tier.
  return priceTier(industry as IndustryKey).fullCents;
}

/**
 * Score a set of already-swept prospects into ranked territory cells.
 * The caller decides the prospect set (one city's sweep, several sweeps, a bbox, …);
 * this only aggregates and ranks.
 */
export function scoreTerritories(
  prospects: ScorableProspect[],
  opts: TerritoryScoreOptions = {},
): TerritoryScore[] {
  const cellDegrees = opts.cellDegrees ?? DEFAULTS.cellDegrees;
  const minCluster = opts.minCluster ?? DEFAULTS.minCluster;
  const datedWeight = opts.datedWeight ?? DEFAULTS.datedWeight;
  const rankByCampaign = opts.rankByCampaign ?? {};
  const rankBoostWeight = opts.rankBoostWeight ?? 0.35;
  const keyOf = opts.cellKey ?? gridCellKey(cellDegrees);

  // 1. Bucket prospects into cells.
  const cells = new Map<string, ScorableProspect[]>();
  for (const p of prospects) {
    const k = keyOf(p);
    if (!k) continue;
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(p);
  }

  // 2. Aggregate each cell.
  const scored: TerritoryScore[] = [];
  for (const [cell, rows] of cells) {
    const byIndustry = new Map<string, IndustryCluster>();
    const byPlace = new Map<string, number>(); // dominant "City, ST" label for this cell
    let noWebsite = 0, dated = 0, hasSite = 0, demandProxy = 0;
    let latSum = 0, lonSum = 0, geoN = 0;
    let rankedQuality = 0; // best rank of any campaign we already rank in this cell

    for (const p of rows) {
      if (p.geo_campaign_id) {
        const q = rankByCampaign[p.geo_campaign_id];
        if (typeof q === 'number' && q > rankedQuality) rankedQuality = q;
      }
      if (p.city) {
        const place = p.region ? `${p.city}, ${p.region}` : p.city;
        byPlace.set(place, (byPlace.get(place) ?? 0) + 1);
      }
      const tier = p.lead_tier;
      if (tier === 'no_website') noWebsite++;
      else if (tier === 'dated') dated++;
      else if (tier === 'has_site') hasSite++;

      if (p.review_count && p.review_count > 0) demandProxy += Math.log1p(p.review_count);
      if (p.address_lat != null && p.address_lon != null) {
        latSum += p.address_lat; lonSum += p.address_lon; geoN++;
      }

      const ind = p.industry_key ?? 'unknown';
      const c = byIndustry.get(ind) ?? {
        industry: ind, noWebsite: 0, dated: 0, hasSite: 0,
        landGrabViable: false, rentValueCents: industryRentCents(p.industry_key),
      };
      if (tier === 'no_website') c.noWebsite++;
      else if (tier === 'dated') c.dated++;
      else if (tier === 'has_site') c.hasSite++;
      byIndustry.set(ind, c);
    }

    const clusters = [...byIndustry.values()].map((c) => ({
      ...c,
      landGrabViable: c.noWebsite >= minCluster,
    }));
    const viable = clusters.filter((c) => c.landGrabViable);
    const estMonthlyRentCents = viable.reduce((s, c) => s + c.rentValueCents, 0);
    const count = rows.length;
    const addressable = noWebsite + datedWeight * dated;
    const saturation = count ? hasSite / count : 0;
    const topIndustry = clusters.slice().sort((a, b) =>
      (b.noWebsite - a.noWebsite) || (b.rentValueCents - a.rentValueCents))[0]?.industry ?? null;
    const label = [...byPlace.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? cell;

    scored.push({
      cell,
      label,
      centroid: geoN ? { lat: latSum / geoN, lon: lonSum / geoN } : { lat: 0, lon: 0 },
      count, addressable, saturation, demandProxy,
      clusters, viableCards: viable.length, estMonthlyRentCents,
      score: 0, // filled after normalization pass
      rankedQuality,
      rationale: { topIndustry, noWebsite, dated, hasSite, rankedHere: rankedQuality > 0 },
    });
  }

  // 3. Normalize into a 0..100 composite. Rent is the primary driver; addressable count
  //    and demand sharpen it; saturation penalizes picked-over areas.
  const maxRent = Math.max(1, ...scored.map((s) => s.estMonthlyRentCents));
  const maxAddr = Math.max(1, ...scored.map((s) => s.addressable));
  const maxDemand = Math.max(1, ...scored.map((s) => s.demandProxy));
  for (const s of scored) {
    const rent = s.estMonthlyRentCents / maxRent; // 0..1 — the money signal
    const addr = s.addressable / maxAddr;
    const demand = s.demandProxy / maxDemand;
    const base = 0.55 * rent + 0.25 * addr + 0.2 * demand - 0.15 * s.saturation;
    // Boost cells where we already rank a pitch page — proven ground beats greenfield.
    const composite = base * (1 + rankBoostWeight * s.rankedQuality);
    s.score = Math.round(Math.max(0, Math.min(1, composite)) * 100);
  }

  return scored.sort((a, b) => b.score - a.score);
}
