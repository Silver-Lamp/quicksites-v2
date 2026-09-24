// lib/serp/classify.ts
//
// The worksheet's scoring rules (docs/SERP_CHECK_WORKSHEET.md), as a pure function. Keep the two
// in step: the manual run is this module's ground truth, and if a hand-scored search disagrees
// with what this returns, THIS is what is wrong.
//
// ⚠️ CALIBRATED 2026-09-22 AGAINST A REAL RUN, AND THE FIRST MODEL WAS WRONG. The original rules
// counted blocks above the first organic result as a stand-in for "did you have to scroll", and
// treated a FULL local pack with few blocks above it as "winnable, lower ceiling". The towing
// control — `towing service near me`, which we KNOW loses: position 10.9, 69 impressions, zero
// clicks — came back `mixed`, and the run correctly refused to be trusted.
//
// The eleven rows showed why. `blocksAbove` was 1 or 2 on EVERY full-pack query; it does not
// discriminate. `packSize` does: every thin-pack query was winnable and every full-pack one was
// not. A full pack is not "one block" — it is a map, three businesses and a "More places" link,
// and on a near-me query it IS the answer. So a full pack is now `skip` on its own, and
// `blocksAbove` only demotes a thin-pack page.
//
// ⚠️ `THIN_PACK_MAX_BLOCKS` IS NOT CALIBRATED. No query in the run had a thin pack AND a crowded
// page, so nothing has tested where that line belongs. It is a guess, and the next run that
// produces such a row is what should settle it. The full-pack rule above is not a guess.
//
// ⚠️ AND WE CLASSIFY DOMAINS, NOT BUSINESSES. A hostname tells you Yelp is a directory. It does
// NOT tell you whether `smokymountaintreehouses.com` is one carpenter or a national chain, so
// `first_organic_kind` is `unknown` there rather than a guess. A wrong "national brand" reading
// would flip a verdict, and an honest unknown keeps the row in the manual-review pile where it
// belongs.

import type { SerpElement, SerpSnapshot } from '@/lib/serp/types';

export type FirstOrganicKind = 'directory' | 'forum' | 'video' | 'retail' | 'unknown';

/** A full pack is three businesses; Google shows fewer only when it has fewer to show. */
export const FULL_PACK = 3;
/**
 * With a THIN pack, this many blocks above the first organic result still counts as reachable.
 * ⚠️ Unvalidated — see the header. A full pack is decided by `FULL_PACK`, not by this.
 */
export const THIN_PACK_MAX_BLOCKS = 3;

const DIRECTORY_HOSTS = [
  'yelp.com', 'angi.com', 'angieslist.com', 'thumbtack.com', 'houzz.com', 'bbb.org',
  'yellowpages.com', 'porch.com', 'homeadvisor.com', 'buildzoom.com', 'manta.com',
  'mapquest.com', 'nextdoor.com', 'birdeye.com', 'chamberofcommerce.com', 'expertise.com',
];
const FORUM_HOSTS = ['reddit.com', 'quora.com', 'stackexchange.com', 'city-data.com', 'permies.com'];
const VIDEO_HOSTS = ['youtube.com', 'vimeo.com', 'tiktok.com'];
const RETAIL_HOSTS = ['amazon.com', 'etsy.com', 'ebay.com', 'homedepot.com', 'lowes.com', 'wayfair.com'];

const hostMatches = (domain: string, list: string[]) =>
  list.some((h) => domain === h || domain.endsWith(`.${h}`));

export function classifyDomain(domain: string | undefined): FirstOrganicKind {
  const d = (domain ?? '').toLowerCase().replace(/^www\./, '');
  if (!d) return 'unknown';
  if (hostMatches(d, DIRECTORY_HOSTS)) return 'directory';
  if (hostMatches(d, FORUM_HOSTS)) return 'forum';
  if (hostMatches(d, VIDEO_HOSTS)) return 'video';
  if (hostMatches(d, RETAIL_HOSTS)) return 'retail';
  // A business's own site. Whether it is local or national is not knowable from a hostname.
  return 'unknown';
}

export type SerpVerdict = 'best' | 'good' | 'mixed' | 'skip';

export type SerpReading = {
  query: string;
  location: string;
  fetchedAt: string;
  /** Businesses in the map pack; 0 when there is no pack. */
  packSize: number;
  /**
   * ⚠️ TREAT 0 AS "NOT REPORTED", NOT AS "NO ADS". Every row of the 2026-09-22 run came back with
   * adCount 0 — including `towing service near me`, a query that certainly carries ads. The
   * organic endpoint does not reliably return `paid` items, so this is recorded but deliberately
   * NOT used by any verdict. Do not add a rule that reads it until a run proves it populates.
   */
  adCount: number;
  aiOverview: boolean;
  /** Elements stacked above the first organic result — the proxy for "needs scrolling". */
  blocksAbove: number;
  firstOrganicDomain: string | null;
  firstOrganicKind: FirstOrganicKind;
  /** Absolute position of the first organic result across all elements, null when there is none. */
  firstOrganicRank: number | null;
  verdict: SerpVerdict;
  /** One line a person can check the verdict against. */
  reason: string;
};

export function readSerp(snapshot: SerpSnapshot): SerpReading {
  const ordered = [...snapshot.elements].sort((a, b) => a.rank - b.rank);
  const firstOrganic = ordered.find((e) => e.kind === 'organic') ?? null;
  const above = firstOrganic ? ordered.filter((e) => e.rank < firstOrganic.rank) : ordered;

  const pack = ordered.find((e) => e.kind === 'local_pack');
  const packSize = pack ? (pack.entries ?? FULL_PACK) : 0;
  const adCount = ordered.filter((e) => e.kind === 'paid').length;
  const aiOverview = ordered.some((e) => e.kind === 'ai_overview');
  const kind = classifyDomain(firstOrganic?.domain);

  const reading: Omit<SerpReading, 'verdict' | 'reason'> = {
    query: snapshot.query,
    location: snapshot.location,
    fetchedAt: snapshot.fetchedAt,
    packSize,
    adCount,
    aiOverview,
    blocksAbove: above.filter((e) => e.kind !== 'organic').length,
    firstOrganicDomain: firstOrganic?.domain ?? null,
    firstOrganicKind: kind,
    firstOrganicRank: firstOrganic?.rank ?? null,
  };

  return { ...reading, ...verdictFor(reading) };
}

/**
 * A page on which we saw NOTHING but organic results — no pack, no ads, no AI overview, nothing
 * above the first organic result.
 *
 * ⚠️ THIS IS NOT A VERDICT, IT IS A REASON TO DOUBT THE INPUT, AND THE ASYMMETRY IS THE POINT.
 * A truncated provider response and a genuinely wide-open SERP are IDENTICAL from one reading, and
 * the truncated one scores `good` — the most favourable verdict there is. Observed 2026-09-23:
 * `dock builder austin` read twice minutes apart returned `item_types` of
 * `[local_pack, organic, people_also_ask, related_searches]` with `se_results_count` 111, and then
 * `[organic, people_also_ask]` with 57. Same query, same location; the second is half a SERP, and
 * our classifier called it wide open.
 *
 * **A feature we SAW is trustworthy; a feature we did not see is not.** So the remedy is a second
 * read rather than a cleverer single-response detector: if the second read shows any feature, the
 * first was short. Two independent truncations of the same query are far less likely than one.
 *
 * ⚠️ Deliberately NOT wired into `verdictFor`. The classifier is correct given its input — the
 * input was wrong, and compensating for a provider defect inside the scoring rule would make the
 * rule wrong for the human path too. **A person cannot be served a truncated SERP**, so a person
 * reporting an empty page is reporting an empty page.
 *
 * Falsifying condition: if a provider stops dropping feature blocks (or the adapter learns to
 * detect it from the response itself), this predicate stops earning its second call — check the
 * disagreement rate the sweep prints before keeping it.
 */
export function isFeatureless(r: Pick<SerpReading, 'packSize' | 'adCount' | 'aiOverview' | 'blocksAbove'>): boolean {
  return r.packSize === 0 && r.adCount === 0 && !r.aiOverview && r.blocksAbove === 0;
}

function verdictFor(r: Omit<SerpReading, 'verdict' | 'reason'>): { verdict: SerpVerdict; reason: string } {
  if (r.firstOrganicRank === null) {
    return { verdict: 'skip', reason: 'No organic result on the page at all.' };
  }

  // ⚠️ FIRST, AND BEFORE ANY RULE ABOUT WHAT RANKS. A full pack sinks the page whatever sits at
  // #1 — the towing control is a full pack with a DIRECTORY first, which the thin-pack rules
  // below would otherwise have called a best case.
  if (r.packSize >= FULL_PACK) {
    return {
      verdict: 'skip',
      reason: `Full ${r.packSize}-business pack — it is the answer for this query, and organic sits under it. This is the towing shape.`,
    };
  }

  if (r.blocksAbove > THIN_PACK_MAX_BLOCKS) {
    return {
      verdict: 'mixed',
      reason: `Pack is thin (${r.packSize}) but ${r.blocksAbove} blocks sit above the first organic result.`,
    };
  }

  // A forum at #1 means the buyer is researching and nobody has published the good answer.
  if (r.firstOrganicKind === 'forum') {
    return { verdict: 'best', reason: `A forum ranks first with a pack of ${r.packSize} — the good answer is unpublished.` };
  }
  if (r.firstOrganicKind === 'directory' || r.firstOrganicKind === 'retail') {
    return {
      verdict: 'best',
      reason: `Pack has ${r.packSize} business${r.packSize === 1 ? '' : 'es'} and Google fell back to a ${r.firstOrganicKind} — a better list wins this.`,
    };
  }
  return { verdict: 'good', reason: `Pack has only ${r.packSize} — organic decides this page.` };
}

/**
 * What a PERSON can see and count, scored by the SAME `verdictFor` the API path uses.
 *
 * ⚠️ THIS EXISTS SO HAND AND MACHINE CANNOT DRIFT. The worksheet is the calibration fixture for
 * the automated reading; the moment a human score runs through a second copy of the rules, the
 * comparison stops meaning anything and both sides can be wrong in the same direction without
 * anyone noticing. So there is one `verdictFor`, private to this file, and two entry points.
 *
 * A person cannot count "blocks above organic" reliably, and after the 2026-09-22 calibration
 * nothing needs them to: pack size decides. `blocksAbove` is optional here and defaults to 0.
 */
export function readHumanSerp(input: {
  query: string;
  location: string;
  packSize: number;
  firstOrganicKind: FirstOrganicKind;
  firstOrganicDomain?: string | null;
  /** Optional, and only ever used to demote a thin-pack page. */
  blocksAbove?: number;
  adCount?: number;
  aiOverview?: boolean;
  checkedAt?: string;
}): SerpReading {
  const reading: Omit<SerpReading, 'verdict' | 'reason'> = {
    query: input.query,
    location: input.location,
    fetchedAt: input.checkedAt ?? new Date().toISOString(),
    packSize: Math.max(0, Math.round(input.packSize)),
    adCount: Math.max(0, Math.round(input.adCount ?? 0)),
    aiOverview: !!input.aiOverview,
    blocksAbove: Math.max(0, Math.round(input.blocksAbove ?? 0)),
    firstOrganicDomain: input.firstOrganicDomain ?? null,
    firstOrganicKind: input.firstOrganicKind,
    // A person reporting a first organic result means there IS one; "none" is its own kind.
    firstOrganicRank: input.firstOrganicKind === 'unknown' && !input.firstOrganicDomain ? 1 : 1,
  };
  return { ...reading, ...verdictFor(reading) };
}

/** A person saw no organic result at all above the fold — its own case, not a missing answer. */
export function readHumanSerpNoOrganic(query: string, location: string, packSize: number): SerpReading {
  const reading: Omit<SerpReading, 'verdict' | 'reason'> = {
    query,
    location,
    fetchedAt: new Date().toISOString(),
    packSize: Math.max(0, Math.round(packSize)),
    adCount: 0,
    aiOverview: false,
    blocksAbove: 0,
    firstOrganicDomain: null,
    firstOrganicKind: 'unknown',
    firstOrganicRank: null,
  };
  return { ...reading, ...verdictFor(reading) };
}

/**
 * Does a person's reading agree with the machine's? The point of running the worksheet by hand.
 * `verdictMatch` is what matters; a pack-size difference of one with the same verdict is noise,
 * a different verdict on the same query is a finding.
 */
export function compareReadings(human: SerpReading, machine: SerpReading) {
  return {
    query: human.query,
    location: human.location,
    humanVerdict: human.verdict,
    machineVerdict: machine.verdict,
    verdictMatch: human.verdict === machine.verdict,
    packDelta: human.packSize - machine.packSize,
    kindMatch: human.firstOrganicKind === machine.firstOrganicKind,
  };
}

/** 🟢 for the worksheet's tally. `mixed` is deliberately not green. */
export const isGreen = (v: SerpVerdict) => v === 'best' || v === 'good';

export type SerpTally = { total: number; green: number; recommendation: string };

/** The worksheet's decision rule, over a set of readings for one niche. */
export const CONTROL_QUERY = 'towing service near me';

/**
 * The control is a CHECK on the reading, never a candidate being scored.
 * Tolerates a missing query: a tally that throws on one malformed row loses the whole run, which
 * is a worse failure than silently not recognising a control.
 */
export const isControlReading = (r: { query?: string | null }) =>
  String(r?.query ?? '').trim().toLowerCase() === CONTROL_QUERY;

/**
 * ⚠️ THE CONTROL IS EXCLUDED HERE, AND IT WAS NOT AT FIRST — THAT BUG CHANGED A DECISION.
 * `towing service near me` is known to lose, so it scores `skip` every time by design. Counted in
 * the denominator it permanently drags every run down by one row: the 2026-09-23 worksheet run
 * read 6/9 = 67% ("Split result — probe the stronger half before spending") when the real figure
 * was 6/8 = 75% ("Real cohort — price the domains"). The CLI said don't buy; the console's own
 * summarise() had it right, and the two disagreeing is what surfaced it.
 *
 * Filtering happens INSIDE tally rather than being left to callers, because "remember to drop the
 * control first" is exactly the instruction that gets forgotten at the one call site nobody
 * re-reads.
 */
export function tally(readings: readonly SerpReading[]): SerpTally {
  const scored = readings.filter((r) => !isControlReading(r));
  const total = scored.length;
  const green = scored.filter((r) => isGreen(r.verdict)).length;
  const ratio = total ? green / total : 0;
  const recommendation =
    total === 0
      ? 'Nothing measured.'
      : ratio >= 0.7
        ? 'Real cohort — price the domains and draft the page structure.'
        : ratio >= 0.4
          ? 'Split result. Probe the stronger half alone before spending.'
          : 'The density proxy did not hold here. Do not buy; fix the scoring first.';
  return { total, green, recommendation };
}
