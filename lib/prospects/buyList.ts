// lib/prospects/buyList.ts
//
// Pre-purchase opportunity scoring for the geo-domain land-grab: turn a fixed budget
// (e.g. "$1000 → ~90 domains") into a RANKED, budget-filled buy-list of the domains most
// likely to (a) rank and (b) rent for the most.
//
// This is the pre-purchase mirror of lib/prospects/rankedOpportunities.ts. That one scores
// domains we already OWN using GSC rank; this one scores city×industry candidates we
// DON'T own yet — so it can't use rank (there's no site). It uses the three signals
// available before buying, all present in swept-prospect data:
//
//   opportunityScore = leadValue × demand × winnability
//
//   leadValue   — priceTier(industry).fullCents (the unlockable rent; dominates)
//   demand      — competing no-website businesses (sub-linear, capped)
//   winnability — soft SEO ground: 1 − w·saturation (exact-match ranks best where
//                 incumbents are weak)
//
// Pure + self-typed (no I/O), mirroring territoryScore.ts / rankedOpportunities.ts so it
// unit-tests in isolation. See docs/DOMAIN_ACQUISITION_PLAN.md.

import type { IndustryKey } from '@/lib/industries';
import { priceTier } from '@/lib/outreach/geoPricing';
import { geoDomainFor } from '@/lib/outreach/geoDomain';

// ── Inputs ──────────────────────────────────────────────────────────────────

/** The minimum a swept prospect row must carry to score a candidate. */
export type BuyListProspect = {
  city?: string | null;
  region?: string | null;
  industry_key?: string | null;
  /** 'no_website' | 'dated' | 'has_site' | … (from classifyLeadTier). */
  lead_tier?: string | null;
  /**
   * Google review count for this business (Place Details, backfilled weekly — often null).
   * Drives the "map-pack strength" signal: a market whose incumbents have few reviews is a
   * softer target (Niche-Finder-style weak-competition analysis). Null = no data (ignored).
   */
  review_count?: number | null;
};

/** An explicit city×industry to include even when no prospects were swept for it. */
export type BuyCandidateInput = {
  city: string;
  region?: string | null;
  industryKey: IndustryKey;
};

export type BuyListOptions = {
  /** Restrict scoring to these industries (default: all industries seen in the data). */
  industries?: IndustryKey[];
  /** City×industry pairs to include even without swept prospects (zero-demand candidates). */
  candidates?: BuyCandidateInput[];
  /** TLD to derive domains under (default 'com'). */
  tld?: string;
  /** Demand boost per competing no-website business (default 0.1). */
  demandWeight?: number;
  /** Cap on competitors counted for demand — the domain rents to ONE winner (default 10). */
  maxDemandCompetitors?: number;
  /** How hard incumbent saturation penalizes winnability, 0..1 (default 0.5). */
  saturationWeight?: number;
  /** Drop buckets with fewer than this many prospects (unless in `candidates`) (default 0). */
  minGroup?: number;
  /**
   * How much a weak/strong review "map pack" swings winnability, 0..1 (default 0.4). A weak
   * pack multiplies up to (1+reviewWeight); a strong pack down to (1−reviewWeight).
   */
  reviewWeight?: number;
  /** Median review count treated as a "medium" market — the strength curve's midpoint (default 25). */
  reviewMidpoint?: number;
  /** Min businesses with review data before the pack-strength signal is applied (default 1). */
  minReviewSample?: number;
};

// ── Outputs ─────────────────────────────────────────────────────────────────

export type BuyCandidate = {
  city: string;
  region: string | null;
  industryKey: IndustryKey;
  /** Exact-match domain to acquire, e.g. "boston-towing.com". */
  domain: string;
  /** Apex label / pitch-site slug, e.g. "boston-towing". */
  slug: string;
  /** Full monthly rent for the tier, in cents (rent if it ranks). */
  monthlyRentCents: number;
  /** Pre-rank founder rate, in cents (what you collect before page 1). */
  lockedRentCents: number;
  noWebsite: number;
  dated: number;
  hasSite: number;
  totalProspects: number;
  /** hasSite / total — incumbent saturation (0 when no prospect data). */
  saturation: number;
  /** 1 + demandWeight·min(noWebsite, cap). */
  demandFactor: number;
  /** Median Google review count among bucket businesses with data — null when none. */
  competitorReviews: number | null;
  /** How many bucket businesses had review data (the pack-strength sample size). */
  reviewSample: number;
  /** 0..1 incumbent strength from median reviews — null when no review data. Higher = harder. */
  packStrength: number | null;
  /** Winnability multiplier from the map pack: >1 weak pack, <1 strong pack, 1 when no data. */
  weakPackFactor: number;
  /** (1 − saturationWeight·saturation) × weakPackFactor, floored — never zeros the score. */
  winnability: number;
  /** leadValue × demand × winnability — the sort key. Higher = buy sooner. */
  score: number;
};

const DEFAULTS = {
  tld: 'com',
  demandWeight: 0.1,
  maxDemandCompetitors: 10,
  saturationWeight: 0.5,
  minGroup: 0,
  reviewWeight: 0.4,
  reviewMidpoint: 25,
  minReviewSample: 1,
};

/** Minimum winnability so a fully-saturated cell is deprioritized, not zeroed out. */
const WINNABILITY_FLOOR = 0.1;

type Bucket = {
  city: string;
  region: string | null;
  industryKey: IndustryKey;
  noWebsite: number;
  dated: number;
  hasSite: number;
  total: number;
  /** Review counts of bucket businesses that have review data (for the median). */
  reviews: number[];
};

function bucketKey(city: string, industryKey: string): string {
  return `${city.trim().toLowerCase()}::${industryKey}`;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Build the ranked buy-list. Groups swept prospects into city×industry buckets (merged
 * with any explicit `candidates`), scores each, and returns them sorted hottest-first.
 */
export function buildBuyList(
  prospects: BuyListProspect[],
  opts: BuyListOptions = {},
): BuyCandidate[] {
  const tld = opts.tld ?? DEFAULTS.tld;
  const demandWeight = opts.demandWeight ?? DEFAULTS.demandWeight;
  const maxDemand = opts.maxDemandCompetitors ?? DEFAULTS.maxDemandCompetitors;
  const saturationWeight = opts.saturationWeight ?? DEFAULTS.saturationWeight;
  const minGroup = opts.minGroup ?? DEFAULTS.minGroup;
  const reviewWeight = opts.reviewWeight ?? DEFAULTS.reviewWeight;
  const reviewMidpoint = opts.reviewMidpoint ?? DEFAULTS.reviewMidpoint;
  const minReviewSample = opts.minReviewSample ?? DEFAULTS.minReviewSample;
  const industryFilter = opts.industries && opts.industries.length ? new Set(opts.industries) : null;

  const buckets = new Map<string, Bucket>();

  const ensure = (city: string, region: string | null, industryKey: IndustryKey): Bucket => {
    const key = bucketKey(city, industryKey);
    let b = buckets.get(key);
    if (!b) {
      b = { city, region, industryKey, noWebsite: 0, dated: 0, hasSite: 0, total: 0, reviews: [] };
      buckets.set(key, b);
    }
    return b;
  };

  // Fold swept prospects into buckets.
  for (const p of prospects) {
    const city = (p.city || '').trim();
    const industryKey = (p.industry_key || '') as IndustryKey;
    if (!city || !industryKey) continue;
    if (industryFilter && !industryFilter.has(industryKey)) continue;
    const b = ensure(city, (p.region ?? null) as string | null, industryKey);
    b.total += 1;
    if (p.lead_tier === 'no_website') b.noWebsite += 1;
    else if (p.lead_tier === 'dated') b.dated += 1;
    else if (p.lead_tier === 'has_site') b.hasSite += 1;
    if (typeof p.review_count === 'number' && Number.isFinite(p.review_count) && p.review_count >= 0) {
      b.reviews.push(p.review_count);
    }
  }

  // Merge explicit candidates (created empty when they have no prospects). These bypass the
  // minGroup floor — the operator asked for them.
  const forced = new Set<string>();
  for (const c of opts.candidates ?? []) {
    const city = (c.city || '').trim();
    if (!city || !c.industryKey) continue;
    if (industryFilter && !industryFilter.has(c.industryKey)) continue;
    ensure(city, c.region ?? null, c.industryKey);
    forced.add(bucketKey(city, c.industryKey));
  }

  const out: BuyCandidate[] = [];
  for (const [key, b] of buckets) {
    if (b.total < minGroup && !forced.has(key)) continue;
    const { domain, slug } = geoDomainFor(b.city, b.industryKey, tld);
    const tier = priceTier(b.industryKey);
    const saturation = b.total > 0 ? b.hasSite / b.total : 0;
    const demandFactor = 1 + demandWeight * Math.min(b.noWebsite, maxDemand);

    // Map-pack strength: how established the incumbents are, from their median review count.
    // Saturating 0..1 curve (midpoint = reviewMidpoint). Weak pack (few reviews) → boost;
    // strong pack → dampen. No review data → neutral (factor 1) so scoring degrades to v1.
    const reviewSample = b.reviews.length;
    const competitorReviews = reviewSample ? median(b.reviews) : null;
    const packStrength =
      competitorReviews == null ? null : competitorReviews / (competitorReviews + reviewMidpoint);
    const weakPackFactor =
      packStrength != null && reviewSample >= minReviewSample
        ? clamp(1 + reviewWeight * (1 - 2 * packStrength), 1 - reviewWeight, 1 + reviewWeight)
        : 1;

    const winnability = Math.max(
      WINNABILITY_FLOOR,
      (1 - saturationWeight * saturation) * weakPackFactor,
    );
    const score = tier.fullCents * demandFactor * winnability;
    out.push({
      city: b.city,
      region: b.region,
      industryKey: b.industryKey,
      domain,
      slug,
      monthlyRentCents: tier.fullCents,
      lockedRentCents: tier.lockedCents,
      noWebsite: b.noWebsite,
      dated: b.dated,
      hasSite: b.hasSite,
      totalProspects: b.total,
      saturation,
      demandFactor,
      competitorReviews,
      reviewSample,
      packStrength,
      weakPackFactor,
      winnability,
      score,
    });
  }

  return out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.noWebsite !== a.noWebsite) return b.noWebsite - a.noWebsite;
    if (a.saturation !== b.saturation) return a.saturation - b.saturation;
    return a.domain.localeCompare(b.domain);
  });
}

// ── Budget fill ───────────────────────────────────────────────────────────────

/** Availability/price for a candidate domain (from the registrar batch check). */
export type AvailabilityInfo = {
  available?: boolean;
  priceUsd?: number | null;
  premium?: boolean;
};

export type BudgetFillOptions = {
  budgetUsd: number;
  /** Per-domain availability + price (keyed by domain). Absent = unknown → assume default price. */
  availabilityByDomain?: Record<string, AvailabilityInfo>;
  /** Assumed yearly price when availability/price is unknown (default 12). */
  defaultPriceUsd?: number;
  /** Max domains to accept per industry (spread the bet across trades). */
  perIndustryCap?: Partial<Record<IndustryKey, number>>;
  /** Skip Vercel-flagged premium domains — they blow the per-domain budget (default true). */
  skipPremium?: boolean;
};

export type SkippedCandidate = { candidate: BuyCandidate; reason: string; priceUsd: number | null };

export type BudgetFillResult = {
  accepted: BuyCandidate[];
  skipped: SkippedCandidate[];
  totalSpendUsd: number;
  /** Sum of founder (locked) rent across accepted — the realistic first-window MRR, in cents. */
  projectedMonthlyRentCents: number;
  /** Sum of full rent across accepted — the MRR if every domain ranks, in cents. */
  projectedFullMonthlyRentCents: number;
  count: number;
};

/**
 * Greedily fill a fixed budget from a ranked buy-list: walk hottest-first, accept each
 * domain whose price fits the remaining budget (and industry cap / availability), and stop
 * only when nothing more fits. Never silently truncates — everything not bought lands in
 * `skipped` with a reason.
 */
export function fillBudget(
  candidates: BuyCandidate[],
  opts: BudgetFillOptions,
): BudgetFillResult {
  const defaultPrice = opts.defaultPriceUsd ?? 12;
  const skipPremium = opts.skipPremium !== false;
  const avail = opts.availabilityByDomain ?? {};

  const accepted: BuyCandidate[] = [];
  const skipped: SkippedCandidate[] = [];
  const perIndustryCount = new Map<IndustryKey, number>();
  let spend = 0;
  let mrr = 0;
  let fullMrr = 0;

  for (const c of candidates) {
    const info = avail[c.domain];
    const priceUsd = info?.priceUsd ?? defaultPrice;

    if (info && info.available === false) {
      skipped.push({ candidate: c, reason: 'unavailable', priceUsd: info.priceUsd ?? null });
      continue;
    }
    if (info?.premium && skipPremium) {
      skipped.push({ candidate: c, reason: 'premium', priceUsd });
      continue;
    }
    const cap = opts.perIndustryCap?.[c.industryKey];
    if (cap != null && (perIndustryCount.get(c.industryKey) ?? 0) >= cap) {
      skipped.push({ candidate: c, reason: 'industry_cap', priceUsd });
      continue;
    }
    if (spend + priceUsd > opts.budgetUsd) {
      // A cheaper later candidate may still fit — keep scanning.
      skipped.push({ candidate: c, reason: 'over_budget', priceUsd });
      continue;
    }

    accepted.push(c);
    spend += priceUsd;
    mrr += c.lockedRentCents;
    fullMrr += c.monthlyRentCents;
    perIndustryCount.set(c.industryKey, (perIndustryCount.get(c.industryKey) ?? 0) + 1);
  }

  return {
    accepted,
    skipped,
    totalSpendUsd: Math.round(spend * 100) / 100,
    projectedMonthlyRentCents: mrr,
    projectedFullMonthlyRentCents: fullMrr,
    count: accepted.length,
  };
}
