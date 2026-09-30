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
import { haversineDistance } from '@/lib/utils/distance';
import { marketRadiusKm } from './marketRadius';

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
  address_lat?: number | null;
  address_lon?: number | null;
  /** ISO timestamp — when the row was first inserted. */
  created_at: string | null;
  /**
   * ISO timestamp — when a sweep last OBSERVED this business.
   *
   * ⚠️ Prefer this over `created_at` for every freshness judgement, via `observedAt()`. A
   * dedupe-ignoring upsert freezes `created_at` at first sight, so re-sweeping a market writes
   * nothing to it and the pool reads stale no matter how recently it was confirmed.
   */
  last_seen_at?: string | null;
};

export type ForwardCampaign = {
  id: string;
  domain: string;
  city: string | null;
  region: string | null;
  industry_key: string | null;
  /**
   * The town's coordinates.
   *
   * ⚠️ NULL on all 129 rows until the 20260858 backfill — the columns existed and nothing ever
   * wrote them. When absent the matcher falls back to city+region equality, which is the old
   * behaviour, so a campaign without a centre degrades rather than matching everything.
   */
  center_lat?: number | null;
  center_lon?: number | null;
  /**
   * Where this campaign's calls go today, when it already has a destination.
   *
   * Carried on the campaign so a caller can tell a first assignment from a REPLACEMENT without
   * a second query — the two want different surfaces (a suggestion card vs a pre-filled
   * re-point box) and, before this, only unassigned campaigns were ever ranked at all.
   */
  current_forward_to?: string | null;
};

/** Phones already spoken for, so one business is not silently wired to two of our domains. */
export type ForwardContext = {
  /** Normalized phone → domain it already receives calls for. */
  forwardedElsewhere?: Map<string, string>;
  /** Normalized phones that replied STOP, globally (`forward_opt_outs`). */
  optedOut?: Set<string>;
  /**
   * Normalized phones we OBSERVED not answering forwarded calls (`forward_unresponsive`).
   *
   * ⚠️ A separate input from `optedOut` because it is a separate fact, and the difference is not
   * bookkeeping: an opt-out is the business's decision and is permanent until they say
   * otherwise, while this is OUR conclusion from OUR evidence and may be wrong (they may simply
   * be screening the unknown number we call from). It disqualifies all the same — there is no
   * point routing an emergency call to a phone that does not pick up — but it is clearable, and
   * the reason a candidate was dropped is reported as the one it actually was.
   */
  unresponsive?: Set<string>;
  /**
   * The campaign's CURRENT forward-to, when recommending a replacement for it.
   *
   * Dropped from the ranking rather than left in it: the question a re-point asks is "who else",
   * and answering it with the business already receiving the calls is not an answer. Reported as
   * its own disqualify reason so the pool does not appear to have silently lost a candidate.
   */
  currentDestination?: string | null;
  /** Evaluation date; injected so tests are not time-dependent. */
  now?: Date;
};

export type DisqualifyReason =
  | 'no_phone'
  | 'industry_mismatch'
  | 'city_mismatch'
  | 'outside_market'
  | 'region_mismatch'
  | 'opted_out'
  | 'unresponsive'
  | 'current_destination';

/**
 * What settled this candidate's place in the order.
 *
 * `score` means the scoring signals separated it. Everything else means they did NOT, and a
 * tiebreaker did — which is a materially weaker claim and is reported as one.
 */
export type DecidedBy = 'score' | 'local_area_code' | 'more_reviews' | 'freshest' | 'stable_name';

export type Candidate = {
  prospect: ForwardProspect;
  score: number;
  /** Why it scored — operator-readable, in descending contribution order. */
  reasons: string[];
  /** Things a person should look at. Deliberately NOT scored: see `areaCodeFlag`. */
  flags: string[];
  /**
   * How this candidate was separated from the one below it.
   *
   * ⚠️ Set on the whole ordered list, so the top entry's value is the one that matters: it says
   * whether the pick is evidence or a coin flip resolved by rule. A tiebreak is never dressed up
   * as a reason the winner is better.
   */
  decidedBy: DecidedBy;
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

/**
 * Is this business in the campaign's market?
 *
 * Distance when both sides have coordinates, city+region equality when they do not.
 *
 * ⚠️ Distance is the better rule and it is not merely a refinement: `prospects.city` is where a
 * business was first swept, so the name test asks "did we happen to discover you under this
 * label" rather than "do you serve this town". Maple Valley qualified 1 of 13 real candidates on
 * the name test. But the fallback is kept, and kept STRICT, because a campaign with no centre
 * must narrow to the old behaviour rather than widen to everything.
 */
export function marketMatch(
  p: ForwardProspect,
  campaign: ForwardCampaign,
): { inMarket: boolean; km: number | null; by: 'distance' | 'city' } {
  const clat = campaign.center_lat;
  const clon = campaign.center_lon;
  const plat = p.address_lat;
  const plon = p.address_lon;
  const haveCoords =
    typeof clat === 'number' && typeof clon === 'number' &&
    typeof plat === 'number' && typeof plon === 'number' &&
    Number.isFinite(clat) && Number.isFinite(clon) &&
    Number.isFinite(plat) && Number.isFinite(plon);

  if (haveCoords) {
    const km = haversineDistance(clat as number, clon as number, plat as number, plon as number);
    return { inMarket: km <= marketRadiusKm(campaign.industry_key), km, by: 'distance' };
  }
  return { inMarket: sameCity(p.city, campaign.city), km: null, by: 'city' };
}

function hasWebsite(p: ForwardProspect): boolean {
  const w = (p.website ?? '').trim();
  return !!w && w.toLowerCase() !== 'no site';
}

/** When we last had evidence this business exists — the observation, not the row's birthday. */
function observedAt(p: ForwardProspect): string | null {
  return p.last_seen_at ?? p.created_at;
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
 * The market's own area code, or '' when too few phones to have an opinion.
 *
 * Same evidence `areaCodeFlag` uses, exposed separately because the tiebreak needs the code
 * itself rather than the sentence.
 */
export function modalAreaCode(marketPhones: (string | null)[]): string {
  const MIN_SAMPLES = 5;
  const codes = marketPhones.map(areaCode).filter(Boolean);
  if (codes.length < MIN_SAMPLES) return '';
  const tally = new Map<string, number>();
  for (const c of codes) tally.set(c, (tally.get(c) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/**
 * Tiebreakers, in order, for when the score cannot separate two candidates.
 *
 * ⚠️ ALWAYS PRODUCES A WINNER. The operator asked for a pick rather than a reported tie, and
 * that is the right call: leaving it open means the number stays unattached and the calls go
 * nowhere at all, which is strictly worse for the caller than a well-reasoned arbitrary choice.
 *
 * ⚠️ But a tiebreak is NOT evidence, and the cascade is ordered so the arbitrary step is last.
 * Real signals first:
 *   1. **Local area code** — the one signal deliberately kept out of the score (a tow operator's
 *      cell is weak evidence, too weak to move a ranking) but decisive when nothing else
 *      separates two businesses. This is not hypothetical: pre-ratings, South Hill tied 61–61 and
 *      fell to PNW Towing (206) over Too Cool Towing (253) purely because "P" sorts before "T" —
 *      and when ratings arrived, Too Cool won on 4.8★/201. The area code had the right answer the
 *      whole time and alphabetical order threw it away.
 *   2. **More reviews** — more public evidence the business is real and operating, independent of
 *      the shrunk rating that already tied.
 *   3. **Freshest observation** — most recently confirmed to exist.
 *   4. **Name** — purely deterministic, so the same pool always yields the same pick. Never
 *      random: a recommendation that changes on reload cannot be reviewed or reproduced.
 */
function separatedBy(a: Candidate, b: Candidate, localCode: string, now: Date): DecidedBy {
  if (a.score !== b.score) return 'score';
  if (localCode) {
    const aLocal = areaCode(a.prospect.phone) === localCode;
    const bLocal = areaCode(b.prospect.phone) === localCode;
    if (aLocal !== bLocal) return 'local_area_code';
  }
  const aRev = a.prospect.review_count ?? 0;
  const bRev = b.prospect.review_count ?? 0;
  if (aRev !== bRev) return 'more_reviews';
  const aAge = daysBetween(observedAt(a.prospect), now);
  const bAge = daysBetween(observedAt(b.prospect), now);
  if (aAge !== bAge) return 'freshest';
  return 'stable_name';
}

/** The ordering `separatedBy` describes. Kept adjacent so the two can never disagree. */
function compareCandidates(a: Candidate, b: Candidate, localCode: string, now: Date): number {
  if (a.score !== b.score) return b.score - a.score;
  if (localCode) {
    const aLocal = areaCode(a.prospect.phone) === localCode ? 1 : 0;
    const bLocal = areaCode(b.prospect.phone) === localCode ? 1 : 0;
    if (aLocal !== bLocal) return bLocal - aLocal;
  }
  const aRev = a.prospect.review_count ?? 0;
  const bRev = b.prospect.review_count ?? 0;
  if (aRev !== bRev) return bRev - aRev;
  const aAge = daysBetween(observedAt(a.prospect), now) ?? Number.MAX_SAFE_INTEGER;
  const bAge = daysBetween(observedAt(b.prospect), now) ?? Number.MAX_SAFE_INTEGER;
  if (aAge !== bAge) return aAge - bAge;
  return (a.prospect.business_name ?? '').localeCompare(b.prospect.business_name ?? '');
}

/** Operator-readable sentence for how the top pick was settled. */
export function decidedByLabel(d: DecidedBy): string {
  switch (d) {
    case 'score':
      return 'clear on the signals';
    case 'local_area_code':
      return 'tied on the signals — picked for the local area code';
    case 'more_reviews':
      return 'tied on the signals — picked for having more reviews';
    case 'freshest':
      return 'tied on the signals — picked as the most recently confirmed';
    case 'stable_name':
      return 'tied on every signal — picked by a stable rule, not because it is better';
  }
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
  const ages = qualified.map((c) => daysBetween(observedAt(c.prospect), now)).filter((d): d is number => d !== null);
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
  const unresponsive = ctx.unresponsive ?? new Set<string>();
  const currentDestination = normalizePhone(ctx.currentDestination) || null;
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
    const market = marketMatch(p, campaign);
    // ⚠️ The region guard belongs ONLY to the city-name fallback. There is a Covington in WA and
    // a Covington in GA, and a name match alone would forward Washington towing calls to
    // Georgia. Distance already answers that far better — the two Covingtons are 3,800 km apart
    // — and applying a region test on top of it would re-introduce the bug it was written to
    // prevent, by excluding a business ten minutes across a state line that genuinely serves the
    // town. Only one of the two rules needs it, and it is the weaker one.
    if (market.by === 'city') {
      if (
        campaign.region &&
        p.region &&
        p.region.trim().toLowerCase() !== campaign.region.trim().toLowerCase()
      ) {
        disqualified.push({ prospect: p, reason: 'region_mismatch' });
        continue;
      }
      if (campaign.city && !market.inMarket) {
        disqualified.push({ prospect: p, reason: 'city_mismatch' });
        continue;
      }
    } else if (!market.inMarket) {
      disqualified.push({ prospect: p, reason: 'outside_market' });
      continue;
    }
    if (optedOut.has(phone)) {
      disqualified.push({ prospect: p, reason: 'opted_out' });
      continue;
    }
    if (unresponsive.has(phone)) {
      disqualified.push({ prospect: p, reason: 'unresponsive' });
      continue;
    }
    if (currentDestination && phone === currentDestination) {
      disqualified.push({ prospect: p, reason: 'current_destination' });
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
    const pAge = daysBetween(observedAt(p), now);
    const prevAge = daysBetween(observedAt(prev), now);
    if (pAge !== null && (prevAge === null || pAge < prevAge)) byPhone.set(key, p);
  }
  const deduped = [...byPhone.values()];

  const marketPhones = deduped.map((p) => p.phone);
  const localCode = modalAreaCode(marketPhones);

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

      // How far the caller's business actually is. Not scored — being closer is not being
      // better within a radius the trade already justifies — but a person routing an emergency
      // call should see it.
      const km = marketMatch(p, campaign).km;
      if (km !== null) reasons.push(`${km.toFixed(1)} km from ${campaign.city ?? 'the market'}`);

      const age = daysBetween(observedAt(p), now);
      if (age !== null && age > 60) flags.push(`last observed ${age} days ago`);

      return { prospect: p, score, reasons, flags, decidedBy: 'score' as DecidedBy };
    })
    .sort((a, b) => compareCandidates(a, b, localCode, now));

  // Record what actually separated each candidate from the next, so the top entry can say
  // whether it won on evidence or on a tiebreak. Computed after sorting because it is a property
  // of adjacent pairs, not of a candidate alone.
  for (let i = 0; i < ranked.length; i++) {
    const next = ranked[i + 1];
    ranked[i].decidedBy = next ? separatedBy(ranked[i], next, localCode, now) : 'score';
  }

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

/**
 * Stop one business becoming the top pick for several campaigns at once.
 *
 * ⚠️ THIS IS THE SHARED-NUMBER BUG IN MIRROR IMAGE, and distance matching created it. Under the
 * old city-name rule each town had its own pool, so overlap was impossible. With a 25 km radius
 * the Seattle-metro campaigns genuinely overlap, and the single highest-scoring tow company won
 * **four** of them — `covingtontow`, `maplevalley-towing`, `renton-towing` and `seatac-towing`
 * all recommended AL Ram Towing. Wiring four of our domains to one phone concentrates every
 * market's calls on one operator, and a caller who rings two of our "different" sites reaches
 * the same business.
 *
 * `forwardedElsewhere` does not catch it: that reads campaigns already ATTACHED, and in a fresh
 * run none are. The conflict exists only between recommendations made in the same breath.
 *
 * ⚠️ Resolved by DISTANCE, not by score. The business keeps the campaign whose town it is
 * closest to — the market it most plausibly serves — and every other campaign moves to its next
 * unclaimed candidate with a flag saying so. Resolving by score instead would hand the business
 * to whichever market happens to rate it highest, which is not a fact about who it serves.
 *
 * Campaigns with no distance (the city-name fallback) are resolved last and arbitrarily-but-
 * stably by domain, since there is nothing better to go on.
 */
export function deconflictTopPicks(recs: ForwardRecommendation[]): ForwardRecommendation[] {
  const claimed = new Map<string, string>(); // phone -> campaign id that keeps it
  const cursor = new Map<string, number>(); // campaign id -> index of its current top pick

  const distanceFor = (rec: ForwardRecommendation, idx: number): number => {
    const c = rec.ranked[idx];
    if (!c) return Number.MAX_SAFE_INTEGER;
    const km = marketMatch(c.prospect, rec.campaign).km;
    return km ?? Number.MAX_SAFE_INTEGER;
  };

  // Iterate to a fixed point: displacing a campaign can create a new collision further down.
  for (let pass = 0; pass < recs.length + 1; pass++) {
    let changed = false;
    claimed.clear();
    // Stable order so the same input always resolves the same way.
    const order = [...recs].sort((a, b) => a.campaign.domain.localeCompare(b.campaign.domain));
    for (const rec of order) {
      const idx = cursor.get(rec.campaign.id) ?? 0;
      const top = rec.ranked[idx];
      if (!top) continue;
      const phone = normalizePhone(top.prospect.phone);
      const holderId = claimed.get(phone);
      if (!holderId) {
        claimed.set(phone, rec.campaign.id);
        continue;
      }
      const holder = recs.find((r) => r.campaign.id === holderId)!;
      const holderIdx = cursor.get(holderId) ?? 0;
      // Closer campaign keeps it; the other advances.
      const loser = distanceFor(rec, idx) < distanceFor(holder, holderIdx) ? holder : rec;
      const winner = loser === rec ? holder : rec;
      claimed.set(phone, winner.campaign.id);
      cursor.set(loser.campaign.id, (cursor.get(loser.campaign.id) ?? 0) + 1);
      changed = true;
    }
    if (!changed) break;
  }

  return recs.map((rec) => {
    const idx = cursor.get(rec.campaign.id) ?? 0;
    if (idx === 0) return rec;
    const skipped = rec.ranked.slice(0, idx);
    const ranked = rec.ranked.slice(idx);
    if (!ranked.length) {
      // Everything it wanted is spoken for. Report that honestly rather than re-using a pick.
      return {
        ...rec,
        ranked,
        autoApplyEligible: false,
        pool: {
          ...rec.pool,
          advice:
            `Every candidate here is a closer fit for a neighbouring campaign ` +
            `(${skipped.map((c) => c.prospect.business_name).join(', ')}). ` +
            'Widen the sweep or accept a shared forward-to deliberately.',
        },
      };
    }
    const note =
      `${skipped.map((c) => c.prospect.business_name).join(', ')} ` +
      `${skipped.length === 1 ? 'is' : 'are'} closer to another campaign's town and went there`;
    return {
      ...rec,
      ranked: [{ ...ranked[0], flags: [...ranked[0].flags, note] }, ...ranked.slice(1)],
      // A pick reached by displacement is not a clean unattended write.
      autoApplyEligible: false,
    };
  });
}
