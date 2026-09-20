// lib/domeBuilders/domesketchFeed.ts
//
// DomeSketch's builders directory as WE consume it — `GET https://domesketch.ai/api/orgs`
// (their reply 2026-09-20: static at build, ETag, `{format:'domesketch-orgs', version:1,
// terms, orgs}`; the record shape is a contract they will not change without mailing us).
//
// The feed's `terms` block is binding on this side, and each rule has a function here so
// the rule and the code cannot drift apart:
//   attribution — every entry that came from DomeSketch reads "Listing from the DomeSketch
//                 builders directory" and links to https://domesketch.ai/builders#<id>.
//   ranking     — DomeSketch ranks by fit then alphabetically with no paid placement; a
//                 consumer that ranks by ANY other rule must say so on its page. We list
//                 alphabetically and say so (DIRECTORY_ORDERING_NOTE).
//   claims      — only what a `sources[]` entry supports. An org whose every source was
//                 read from a search listing (their site blocks automated reads) is weaker:
//                 we carry its name, site and kinds but NOT its summary.
//   agreement   — "No entry has agreed to anything with DomeSketch beyond being listed",
//                 so nothing here may imply a builder consented to pay-per-call or to
//                 receiving forwarded calls. Being listed is not an agreement.

export const DOMESKETCH_FEED_URL = 'https://domesketch.ai/api/orgs';
export const DOMESKETCH_ATTRIBUTION = 'Listing from the DomeSketch builders directory';

/** What our directory pages say about their own order — the feed's `terms.ranking` requires it. */
export const DIRECTORY_ORDERING_NOTE =
  'Listed alphabetically — no paid placement, and being listed here is not an agreement with anyone.';

export type DomesketchSource = { url?: string; note?: string; label?: string } | string;

export type DomesketchOrg = {
  id: string;
  name: string;
  url?: string;
  regions?: string[];
  categories?: string[];
  summary?: string;
  sources?: DomesketchSource[];
  claimed?: boolean;
};

export type DomesketchFeed = {
  format: 'domesketch-orgs';
  version: 1;
  generated?: string;
  count?: number;
  terms?: Record<string, string>;
  orgs: DomesketchOrg[];
};

export function listingUrl(id: string): string {
  return `https://domesketch.ai/builders#${encodeURIComponent(id)}`;
}

/** The canonical calculator link DomeSketch asked for (their UTM convention, not ours). */
export function calculatorUrl(fromDomain: string): string {
  return `https://domesketch.ai/?utm_source=quicksites&utm_medium=referral&utm_campaign=${encodeURIComponent(fromDomain)}`;
}

const WEAK_NOTE = /search listing/i;

/**
 * True when EVERY source note says it was read from a search listing — the org's own site
 * blocks automated reads, so the summary is second-hand. One first-hand source is enough.
 */
export function isWeakSource(org: Pick<DomesketchOrg, 'sources'>): boolean {
  const notes = (org.sources ?? []).map((s) => (typeof s === 'string' ? '' : (s.note ?? '')));
  if (!notes.length) return true;
  return notes.every((n) => WEAK_NOTE.test(n));
}

/** Accept only the contracted shape; a wrong `format`/`version` is refused, never guessed at. */
export function parseFeed(body: unknown): DomesketchFeed {
  const b = body as Partial<DomesketchFeed> | null;
  if (!b || b.format !== 'domesketch-orgs' || b.version !== 1 || !Array.isArray(b.orgs)) {
    throw new Error('domesketch feed: unexpected shape (want format=domesketch-orgs, version=1, orgs[])');
  }
  for (const o of b.orgs) {
    if (!o || typeof o.id !== 'string' || typeof o.name !== 'string') {
      throw new Error('domesketch feed: an org lacks id/name');
    }
  }
  return b as DomesketchFeed;
}

export async function fetchDomesketchFeed(fetchImpl: typeof fetch = fetch): Promise<DomesketchFeed> {
  const res = await fetchImpl(DOMESKETCH_FEED_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`domesketch feed: HTTP ${res.status}`);
  return parseFeed(await res.json());
}

/** The fields a DomeSketch org contributes to a `builders_directory` entry. */
export type DomesketchEntryFields = {
  name: string;
  website: string;
  summary: string;
  source_label: string;
  source_url: string;
};

/** Attribution + claims rules applied to one org. Kinds/region are the caller's (they differ per page). */
export function orgEntryFields(org: DomesketchOrg): DomesketchEntryFields {
  return {
    name: org.name,
    website: org.url ?? '',
    summary: isWeakSource(org) ? '' : (org.summary ?? ''),
    source_label: DOMESKETCH_ATTRIBUTION,
    source_url: listingUrl(org.id),
  };
}

/** Alphabetical by name, case-insensitive, stable — the only ordering our pages use. */
export function sortAlphabetically<T extends { name: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
