// lib/serp/rate.ts
//
// THE UNIT OF MEASUREMENT IS A RATE, NOT A VERDICT.
//
// ⚠️ WHY THIS EXISTS. Two full sweeps on 2026-09-23 disagreed with each other, and the treehouse
// control — a live cohort with four sites and a builder ranking first for its own query — moved
// from 6/8 green to 1/3. Chasing it down: of 9 repeated queries that flipped verdict, ONE was a
// truncated provider response. The other eight came back the same size with a different page.
//
//   treehouse builder denver, half an hour apart, same location, same se_results_count (111):
//     read A  36 items  [ai_overview, organic, people_also_ask, related_searches,
//                        google_reviews, knowledge_graph]        -> no pack -> "good"
//     read B  37 items  [organic, local_pack, people_also_ask,
//                        related_searches]                       -> full pack -> "skip"
//
// Both pages are real. Google serves more than one layout for the same query, so a single read
// samples a layout — it does not measure the query. The pack sizes said the same thing all along
// and nobody looked: across 81 readings, 26 at pack 0 and 54 at pack 3, and NOTHING at 1 or 2.
// The pack is present or absent; it never thins. So on the API path `packSize >= FULL_PACK ->
// skip` was really answering *"was a pack served to THIS request?"* — a coin whose bias we had
// never measured, reported as a property of the niche.
//
// What actually decides whether an organic result can win the page is **how often a full pack is
// there at all**. That is a proportion, it needs K reads, and it comes with an interval. This
// module is that: pure, no I/O, so the same function scores stored rows and a fresh sweep.

import { FULL_PACK, type SerpVerdict } from './classify';

/** The fields a rate needs from a reading. Deliberately narrow: a DB row satisfies it too. */
export type RateInput = {
  packSize: number;
  aiOverview: boolean;
  verdict: SerpVerdict;
  /**
   * False when this reading cannot support a "nothing local above organic" claim — see
   * `lib/serp/aiOverview.ts`. Such a reading is dropped from the rate entirely.
   *
   * ⚠️ NOT counted as pack-served either. Counting an unopened box as "a pack was there" would
   * invent evidence in the opposite direction; the honest answer is that we do not know, and the
   * interval is already the tool for saying so — five real reads produce a wide band, which is
   * correct, where 23 reads of which 18 are blind would produce a narrow and false one.
   */
  packFreeVerifiable?: boolean;
};

export type RateVerdict = 'winnable' | 'contested' | 'lost';

export type QueryRate = {
  query: string;
  location: string;
  reads: number;
  /** Reads in which a FULL pack was served — the shape that sinks an organic result. */
  packServed: number;
  aiOverviewServed: number;
  /** The headline: share of impressions with no full pack. The point estimate. */
  packFreeRate: number;
  /** Wilson 95% bounds on `packFreeRate`. The reason this module exists. */
  lo: number;
  hi: number;
  verdict: RateVerdict;
  /**
   * Did the reads differ from each other at all? ⚠️ If this is false everywhere, suspect a cached
   * provider response rather than a stable SERP — identical reads produce a tight interval and
   * therefore FALSE CONFIDENCE, which is the failure this whole module exists to prevent,
   * reintroduced one level up.
   */
  varied: boolean;
  /**
   * Reads discarded because an unfetched AI Overview made "pack-free" unverifiable.
   * ⚠️ A high number against a small `reads` means the confident-looking rate above it rests on
   * very little. Surface it wherever the rate is surfaced.
   */
  blind: number;
};

export type NicheRate = {
  key: string;
  reads: number;
  queries: number;
  /** Mean pack-free rate across this niche's queries, each query weighted equally. */
  packFreeRate: number;
  /** `winnable` if ANY query resolves winnable — see the note in `rateNiche`. */
  verdict: RateVerdict;
  /** Queries that resolved winnable. This is the number to act on: it is how many pages to aim at. */
  winnable: number;
  /** Queries that resolved lost. A constraint on which page to target, not a disqualification. */
  lost: number;
  resolved: number;
  contested: number;
  /** Reads discarded as unverifiable across this niche's queries. */
  blind: number;
};

/**
 * Wilson score interval for a proportion.
 *
 * Chosen over the normal approximation on purpose: at K=5 the normal interval on 5/5 successes is
 * [1, 1] — zero width, total certainty, from five observations. Wilson gives [0.566, 1.0], which is
 * the honest answer and still resolves the case. A tool whose error bar vanishes exactly when the
 * sample is smallest is worse than no error bar, because it looks like proof.
 */
export function wilson(successes: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/**
 * ⚠️ THE THRESHOLD IS THE INTERVAL, NOT THE POINT ESTIMATE, AND THAT IS THE WHOLE DESIGN.
 *
 * `4/5 = 80% pack-free` sounds decisive and is not: its 95% interval runs from 0.376 to 0.964, so
 * it does not even establish that the pack is absent more often than it is present. Calling that
 * `winnable` is precisely the mistake the binary sweep made at n=3.
 *
 * Consequence worth knowing before running it: **at K=5 only a UNANIMOUS query resolves.** Most
 * rows will read `contested`, and that is the true answer rather than a failure of the niche or of
 * the tool. To resolve a split query, raise K — the interval is the thing telling you the price.
 */
function verdictFor(lo: number, hi: number): RateVerdict {
  if (lo >= 0.5) return 'winnable';
  if (hi <= 0.5) return 'lost';
  return 'contested';
}

export function rateQuery(query: string, location: string, reads: readonly RateInput[]): QueryRate {
  // ⚠️ Drop the readings whose "no pack" we could not verify. Keeping them at face value is how a
  // niche reached 100% pack-free over 23 reads while every one of those reads carried an AI
  // Overview nobody had opened.
  const blind = reads.filter((r) => r.packFreeVerifiable === false).length;
  const usable = reads.filter((r) => r.packFreeVerifiable !== false);
  const n = usable.length;
  const packServed = usable.filter((r) => r.packSize >= FULL_PACK).length;
  const packFree = n - packServed;
  const { lo, hi } = wilson(packFree, n);
  const shapes = new Set(usable.map((r) => `${r.packSize}|${r.aiOverview}`));
  return {
    query,
    location,
    reads: n,
    packServed,
    aiOverviewServed: reads.filter((r) => r.aiOverview).length,
    blind,
    packFreeRate: n ? packFree / n : 0,
    lo,
    hi,
    verdict: verdictFor(lo, hi),
    varied: shapes.size > 1,
  };
}

/**
 * Roll queries up to a niche. Each query weighs the same regardless of how many times it was read,
 * so a query that happened to get re-read ten times cannot outvote the other two.
 */
export function rateNiche(key: string, queries: readonly QueryRate[]): NicheRate {
  const reads = queries.reduce((s, q) => s + q.reads, 0);
  const blind = queries.reduce((s, q) => s + q.blind, 0);
  const packFreeRate = queries.length
    ? queries.reduce((s, q) => s + q.packFreeRate, 0) / queries.length
    : 0;
  const winnable = queries.filter((q) => q.verdict === 'winnable').length;
  const lost = queries.filter((q) => q.verdict === 'lost').length;

  // ⚠️ THE NICHE VERDICT ASKS "IS THERE A PAGE HERE WE CAN WIN", NOT "IS EVERY PAGE WINNABLE", AND
  // THE FIRST VERSION GOT THAT WRONG IN A WAY THE CONTROL CAUGHT WITHIN THE HOUR.
  //
  // It read *"a niche is only as good as its worst resolved query"* — any lost query made the niche
  // `lost`. That sounds prudent and is not: it scored TREEHOUSES as lost, a live cohort with four
  // sites and a builder ranking first for its own query. The real measurement underneath was right
  // and is the useful part:
  //
  //     treehouse builder austin        8 reads   100% pack-free [68-100]  winnable
  //     custom treehouse company austin 6 reads     0% pack-free [0-39]    lost
  //
  // Both are true. You build for the query you can win and ignore the other — a lost query is a
  // constraint on WHICH page to target, never a disqualification of the niche. Conflating the two
  // is the same error as averaging, arriving from the opposite direction: one throws away the
  // distinction by blending, the other by letting the worst row speak for the rest.
  //
  // So: `winnable` = at least one query resolves winnable. `lost` = something resolved and ALL of
  // it lost (no page here to aim at). `contested` = nothing resolved yet, which is not a finding.
  const verdict: RateVerdict = winnable > 0 ? 'winnable' : lost > 0 ? 'lost' : 'contested';
  return {
    key,
    reads,
    queries: queries.length,
    packFreeRate,
    verdict,
    winnable,
    lost,
    resolved: queries.filter((q) => q.verdict !== 'contested').length,
    contested: queries.filter((q) => q.verdict === 'contested').length,
    blind,
  };
}

/**
 * How many more reads a query needs before its interval could clear 0.5, assuming the rate holds.
 * Used to say "this one needs 4 more reads" instead of "inconclusive", so the next spend is aimed.
 * Returns 0 when already resolved, and null when the observed rate is 0.5 — no amount of reading
 * resolves a genuine coin flip, and pretending otherwise would sell an unbounded budget.
 */
export function readsToResolve(rate: QueryRate, max = 40): number | null {
  if (rate.verdict !== 'contested') return 0;
  const p = rate.packFreeRate;
  if (p === 0.5) return null;
  for (let n = rate.reads + 1; n <= max; n++) {
    const successes = Math.round(p * n);
    const { lo, hi } = wilson(successes, n);
    if (lo >= 0.5 || hi <= 0.5) return n - rate.reads;
  }
  return null;
}
