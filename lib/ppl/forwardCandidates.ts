// lib/ppl/forwardCandidates.ts
//
// WHICH BUSINESS SHOULD THIS CAMPAIGN'S CALLS GO TO — ranked, with the evidence attached.
//
// A ranked geo domain with a tracking number and no forward-to is a phone that rings nowhere.
// The obvious fix is to point it at some nearby business in the same trade. This module picks
// which one, from `outreach_prospects`, and — more importantly — says how much the pick is
// worth believing.
//
// ⚠️ THE POOL QUALITY IS THE POINT, NOT THE RANKING. The first three markets this was built for
// (South Hill, Cullman, Covington) each had exactly TWO candidates, both from a shallow
// 2026-07-12 sweep that recorded no ratings at all, while every sweep since returns 14–19 per
// city WITH ratings. Ranking two arbitrary unrated names produces a confident-looking #1 that is
// really a coin flip — and the thing being decided is where a stranger's towing call lands at
// 2am. So `assessPool` runs first and an unusable pool says RE-SWEEP rather than naming a winner.
// A recommender that always recommends is indistinguishable from one that guesses.
//
// ⚠️ SCORE RANKS; IT DOES NOT AUTHORIZE. `autoApplyEligible` is a separate, deliberately
// conservative predicate — see its comment. Being top of a two-horse race is not evidence.
//
// ⚠️ Every recommendation carries `requiresNotice: true`. Forwarding calls to a business that
// never asked for them is a thing done TO someone; `lib/ppl/forwardNotice.ts` is the designed
// consent path (one-time SMS, says what is happening and how to stop it) and is part of the
// action, never an optional follow-up.
import { cleanCityName } from '@/lib/geo/cleanCityName';

export type ForwardProspect = {
  id: string;
  business_name: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  industry_key: string | null;
  rating: number | null;
  review_count: number | null;
  status: string | null;
  /** ISO timestamp — how old the observation is, which is a fact about the pool, not the business. */
  created_at: string | null;
};

export type ForwardCampaign = {
  id: string;
  domain: string;
  city: string | null;
  region: string | null;
  industry_key: string | null;
};

/** Phones already spoken for, so one business is not silently wired to two of our domains. */
export type ForwardContext = {
  /** Normalized phone → domain it already receives calls for. */
  forwardedElsewhere?: Map<string, string>;
  /** Normalized phones that replied STOP, globally (`forward_opt_outs`). */
  optedOut?: Set<string>;
  /** Evaluation date; injected so tests are not time-dependent. */
  now?: Date;
};

export type DisqualifyReason =
  | 'no_phone'
  | 'industry_mismatch'
  | 'city_mismatch'
  | 'region_mismatch'
  | 'opted_out';

export type Candidate = {
  prospect: ForwardProspect;
  score: number;
  /** Why it scored — operator-readable, in descending contribution order. */
  reasons: string[];
  /** Things a person should look at. Deliberately NOT scored: see `areaCodeFlag`. */
  flags: string[];
};

export type PoolVerdict = 'usable' | 'thin' | 'stale' | 'empty';

export type PoolQuality = {
  considered: number;
  qualified: number;
  rated: number;
  /** Age in days of the freshest qualified observation, or null when none. */
  freshestDays: number | null;
  verdict: PoolVerdict;
  /** One sentence a person can act on. */
  advice: string;
};

export type ForwardRecommendation = {
  campaign: ForwardCampaign;
  ranked: Candidate[];
  disqualified: { prospect: ForwardProspect; reason: DisqualifyReason }[];
  pool: PoolQuality;
  /** True only when the data earns an unattended write — see `autoApplyEligible`. */
  autoApplyEligible: boolean;
  /** Always true. The consent notice is part of attaching, not a later courtesy. */
  requiresNotice: true;
};

/** Digits only, US-normalized to 10 so `(253) 204-1234` and `+12532041234` compare equal. */
export function normalizePhone(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D+/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d;
}

function areaCode(raw: string | null | undefined): string {
  const n = normalizePhone(raw);
  return n.length === 10 ? n.slice(0, 3) : '';
}

function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = cleanCityName(a).toLowerCase();
  const y = cleanCityName(b).toLowerCase();
  return !!x && !!y && x === y;
}

function hasWebsite(p: ForwardProspect): boolean {
  const w = (p.website ?? '').trim();
  return !!w && w.toLowerCase() !== 'no site';
}

function daysBetween(then: string | null, now: Date): number | null {
  if (!then) return null;
  const t = Date.parse(then);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/**
 * Shrunk rating, so a 5.0 from 2 reviews does not outrank a 4.6 from 200.
 *
 * ⚠️ An unrated business scores exactly the PRIOR, never zero. Most of the no-website cohort is
 * unrated, and scoring absence as badness would rank the pool by how thoroughly Google has
 * noticed it — which is close to the opposite of what we want, since invisibility on Google is
 * the trait that makes them a prospect in the first place.
 */
export function shrunkRating(rating: number | null, reviews: number | null): number {
  const PRIOR = 4.3;
  const WEIGHT = 10;
  const r = typeof rating === 'number' && Number.isFinite(rating) && rating > 0 ? rating : null;
  const v = typeof reviews === 'number' && Number.isFinite(reviews) && reviews > 0 ? reviews : 0;
  if (r === null) return PRIOR;
  return (v / (v + WEIGHT)) * r + (WEIGHT / (v + WEIGHT)) * PRIOR;
}

/**
 * Does this candidate's area code look local, judged against the OTHER prospects in the market
 * rather than a hardcoded table?
 *
 * ⚠️ Returns null unless the market supplies at least `MIN_SAMPLES` phones, and the result is a
 * FLAG rather than a score component. A tow operator's number is usually a cell, so a
 * neighbouring area code is weak evidence of anything; strong enough to show a person, not
 * strong enough to move a ranking. With a two-row pool it correctly has no opinion.
 */
export function areaCodeFlag(
  candidate: ForwardProspect,
  marketPhones: (string | null)[],
): string | null {
  const MIN_SAMPLES = 5;
  const codes = marketPhones.map(areaCode).filter(Boolean);
  if (codes.length < MIN_SAMPLES) return null;
  const tally = new Map<string, number>();
  for (const c of codes) tally.set(c, (tally.get(c) ?? 0) + 1);
  const modal = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  const mine = areaCode(candidate.phone);
  if (!mine || !modal || mine === modal[0]) return null;
  return `area code ${mine} is not the local ${modal[0]} — check they actually serve this town`;
}

/**
 * Is the candidate pool good enough to pick from at all?
 *
 * The thresholds are set from the fleet's own sweep behaviour: a current sweep of a towing market
 * returns 14–19 businesses with ratings on nearly all of them, so a market offering two unrated
 * rows from eleven weeks ago has not been measured, it has been glanced at.
 */
export function assessPool(
  qualified: Candidate[],
  consideredCount: number,
  now: Date,
): PoolQuality {
  const rated = qualified.filter((c) => typeof c.prospect.rating === 'number' && c.prospect.rating! > 0).length;
  const ages = qualified.map((c) => daysBetween(c.prospect.created_at, now)).filter((d): d is number => d !== null);
  const freshestDays = ages.length ? Math.min(...ages) : null;

  const base = {
    considered: consideredCount,
    qualified: qualified.length,
    rated,
    freshestDays,
  };

  if (qualified.length === 0) {
    return {
      ...base,
      verdict: 'empty',
      advice: 'No qualifying business in this market. Sweep the city before attaching a number.',
    };
  }
  // Staleness is judged before thinness: a stale pool is ALSO probably thin, and "re-sweep" is
  // the same remedy, but naming the age tells the operator why a re-sweep will actually help.
  if (freshestDays !== null && freshestDays > 60) {
    return {
      ...base,
      verdict: 'stale',
      advice:
        `Every candidate was observed ${freshestDays} days ago. Businesses close and phones change; ` +
        're-sweep this city so the pick is made on current data.',
    };
  }
  if (qualified.length < 4 || rated === 0) {
    return {
      ...base,
      verdict: 'thin',
      advice:
        `Only ${qualified.length} candidate(s)${rated === 0 ? ', none with a rating' : ''}. ` +
        'A current sweep of a market this size normally returns a dozen or more — re-sweep before choosing.',
    };
  }
  return {
    ...base,
    verdict: 'usable',
    advice: `${qualified.length} candidates, ${rated} with ratings. Review the top pick and send the forwarding notice.`,
  };
}

/**
 * Rank the businesses a campaign could forward to.
 *
 * Hard requirements filter (a missing phone cannot be outweighed by a good rating); everything
 * else scores. The returned `reasons` are what the operator reads — a bare number is not a
 * recommendation anyone can check.
 */
export function recommendForwardTargets(
  campaign: ForwardCampaign,
  prospects: ForwardProspect[],
  ctx: ForwardContext = {},
): ForwardRecommendation {
  const now = ctx.now ?? new Date();
  const optedOut = ctx.optedOut ?? new Set<string>();
  const forwardedElsewhere = ctx.forwardedElsewhere ?? new Map<string, string>();

  const disqualified: { prospect: ForwardProspect; reason: DisqualifyReason }[] = [];
  const kept: ForwardProspect[] = [];

  for (const p of prospects) {
    const phone = normalizePhone(p.phone);
    if (!phone || phone.length !== 10) {
      disqualified.push({ prospect: p, reason: 'no_phone' });
      continue;
    }
    if (campaign.industry_key && p.industry_key && p.industry_key !== campaign.industry_key) {
      disqualified.push({ prospect: p, reason: 'industry_mismatch' });
      continue;
    }
    // ⚠️ Region is checked separately from city and BOTH matter: there is a Covington in WA and a
    // Covington in GA, and a city-name-only match would happily forward Washington towing calls
    // to Georgia. This is the same class as the résumé bug where "the sites you own" stood in for
    // "the site that is about you" — a key that is unique in the sample but not in the world.
    if (campaign.region && p.region && p.region.trim().toLowerCase() !== campaign.region.trim().toLowerCase()) {
      disqualified.push({ prospect: p, reason: 'region_mismatch' });
      continue;
    }
    if (campaign.city && !sameCity(p.city, campaign.city)) {
      disqualified.push({ prospect: p, reason: 'city_mismatch' });
      continue;
    }
    if (optedOut.has(phone)) {
      disqualified.push({ prospect: p, reason: 'opted_out' });
      continue;
    }
    kept.push(p);
  }

  // ⚠️ DEDUPE ON THE PHONE, NOT THE id OR THE NAME. Repeated sweeps of a city insert a second
  // row for the same business (live data has "Space Age Wrecker and Recovery" twice on one
  // number — once unrated from July, once rated from September). Left alone it shows the
  // operator the same business twice AND inflates `pool.qualified`, which is an input to
  // `autoApplyEligible` — so a duplicate could talk the system into an unattended write.
  // Keep the most informative row: rated beats unrated, then freshest.
  const byPhone = new Map<string, ForwardProspect>();
  for (const p of kept) {
    const key = normalizePhone(p.phone);
    const prev = byPhone.get(key);
    if (!prev) {
      byPhone.set(key, p);
      continue;
    }
    const pRated = typeof p.rating === 'number' && p.rating > 0;
    const prevRated = typeof prev.rating === 'number' && prev.rating > 0;
    if (pRated !== prevRated) {
      if (pRated) byPhone.set(key, p);
      continue;
    }
    const pAge = daysBetween(p.created_at, now);
    const prevAge = daysBetween(prev.created_at, now);
    if (pAge !== null && (prevAge === null || pAge < prevAge)) byPhone.set(key, p);
  }
  const deduped = [...byPhone.values()];

  const marketPhones = deduped.map((p) => p.phone);

  const ranked: Candidate[] = deduped
    .map((p) => {
      const reasons: string[] = [];
      const flags: string[] = [];
      let score = 0;

      // The core of the pitch: a business with no website has no other channel for this demand,
      // so the calls are worth most to them and they are likeliest to want them.
      if (!hasWebsite(p)) {
        score += 40;
        reasons.push('no website — these calls are their only channel for this demand');
      } else {
        reasons.push('already has a website');
      }

      const sr = shrunkRating(p.rating, p.review_count);
      const ratingPoints = Math.round((sr - 3.5) * 20);
      score += ratingPoints;
      if (typeof p.rating === 'number' && p.rating > 0) {
        reasons.push(`rated ${p.rating}★ from ${p.review_count ?? 0} reviews (adjusted ${sr.toFixed(2)})`);
      } else {
        reasons.push('no Google rating — scored at the neutral prior, not penalised');
      }

      // A business already in our funnel has context for the notice; a cold one gets a text out
      // of nowhere. Small, because it measures our activity rather than their suitability.
      if (p.status === 'claimed') {
        score += 10;
        reasons.push('already claimed a site from us — warmest possible contact');
      } else if (p.status === 'draft_built') {
        score += 5;
        reasons.push('we already built them a draft — the notice will not be cold');
      }

      const phone = normalizePhone(p.phone);
      const already = forwardedElsewhere.get(phone);
      if (already) {
        // ⚠️ Penalised hard but NOT disqualified: one operator legitimately covers two towns, and
        // refusing outright would strand a market that has a single real business. But two of our
        // domains ringing one phone is a thing a caller can notice, so a person decides.
        score -= 50;
        flags.push(`already receives forwarded calls from ${already}`);
      }

      const ac = areaCodeFlag(p, marketPhones);
      if (ac) flags.push(ac);

      const age = daysBetween(p.created_at, now);
      if (age !== null && age > 60) flags.push(`last observed ${age} days ago`);

      return { prospect: p, score, reasons, flags };
    })
    .sort((a, b) => b.score - a.score || (a.prospect.business_name ?? '').localeCompare(b.prospect.business_name ?? ''));

  const pool = assessPool(ranked, prospects.length, now);

  return {
    campaign,
    ranked,
    disqualified,
    pool,
    autoApplyEligible: isAutoApplyEligible(ranked, pool),
    requiresNotice: true,
  };
}

/**
 * May this recommendation be written without a person looking at it?
 *
 * ⚠️ Deliberately strict, and separate from the score. Ranking answers "which is best of these";
 * this answers "is best of these good enough to act on unattended", and the two come apart
 * exactly when the pool is bad — which is when an unattended write does the most damage. The
 * decision routes a stranger's emergency call to a business chosen by a script, so it requires a
 * healthy pool, a real field of candidates, a clear winner rather than a near-tie, and no flag on
 * the winner. Anything less is surfaced for a person, which is still the whole value: the
 * shortlist and its reasons are the work, the click is not.
 */
export function isAutoApplyEligible(ranked: Candidate[], pool: PoolQuality): boolean {
  if (pool.verdict !== 'usable') return false;
  if (ranked.length < 3) return false;
  const [first, second] = ranked;
  if (!first || first.flags.length > 0) return false;
  if (first.score <= 0) return false;
  return first.score - second.score >= 15;
}
