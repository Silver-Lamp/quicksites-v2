// lib/serp/classify.ts
//
// The worksheet's scoring rules (docs/SERP_CHECK_WORKSHEET.md), as a pure function. Keep the two
// in step: the manual run is this module's ground truth, and if a hand-scored search disagrees
// with what this returns, THIS is what is wrong.
//
// ⚠️ ONE SUBSTITUTION, AND IT IS THE HONEST WEAK POINT. The worksheet asks "is the first organic
// result visible without scrolling", which is a question about pixels — screen size, device, how
// tall Google drew the AI overview today. An API cannot answer it. So we count **how many blocks
// sit above the first organic result** instead, which is what causes the scrolling rather than
// the scrolling itself. `blocksAbove` is a proxy; `MIXED_MAX_BLOCKS` is where we drew the line
// between "reachable" and "buried", and the ten manual searches exist to calibrate exactly that
// number. If hand and machine disagree, move this threshold — do not re-word the worksheet.
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
/** Above this many blocks before the first organic result, treat it as buried. */
export const MIXED_MAX_BLOCKS = 2;

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

function verdictFor(r: Omit<SerpReading, 'verdict' | 'reason'>): { verdict: SerpVerdict; reason: string } {
  if (r.firstOrganicRank === null) {
    return { verdict: 'skip', reason: 'No organic result on the page at all.' };
  }
  const thinPack = r.packSize < FULL_PACK;

  // A forum at #1 means the buyer is researching and nobody has published the good answer.
  if (r.firstOrganicKind === 'forum' && thinPack) {
    return { verdict: 'best', reason: 'A forum ranks first with a thin pack — the good answer is unpublished.' };
  }
  if (thinPack && (r.firstOrganicKind === 'directory' || r.firstOrganicKind === 'retail')) {
    return {
      verdict: 'best',
      reason: `Pack has ${r.packSize} business${r.packSize === 1 ? '' : 'es'} and Google fell back to a ${r.firstOrganicKind} — a better list wins this.`,
    };
  }
  if (thinPack) {
    return { verdict: 'good', reason: `Pack has only ${r.packSize} — organic decides this page.` };
  }
  if (r.blocksAbove <= MIXED_MAX_BLOCKS) {
    return { verdict: 'mixed', reason: `Full pack, but only ${r.blocksAbove} block(s) above organic — winnable, lower ceiling.` };
  }
  return {
    verdict: 'skip',
    reason: `Full pack and ${r.blocksAbove} blocks above the first organic result — this is the towing shape.`,
  };
}

/** 🟢 for the worksheet's tally. `mixed` is deliberately not green. */
export const isGreen = (v: SerpVerdict) => v === 'best' || v === 'good';

export type SerpTally = { total: number; green: number; recommendation: string };

/** The worksheet's decision rule, over a set of readings for one niche. */
export function tally(readings: readonly SerpReading[]): SerpTally {
  const total = readings.length;
  const green = readings.filter((r) => isGreen(r.verdict)).length;
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
