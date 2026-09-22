// lib/gsc/fleetScope.ts
//
// Which recorded search traffic counts as a measurement OF THE BUSINESS.
//
// The first query harvest found one page carrying 614 impressions at position 7.9 — 21% of every
// impression across 92 domains, better than every commercial page combined, and about a person
// rather than a product. It had been setting the fleet's average position and our sense of what
// was working, invisibly, for months.
//
// ⚠️ EXCLUDE AT READ, NEVER AT WRITE. The rows are still harvested and still stored: the page is
// real, its ranking is real, and someone will want to see how it performs. What it must not do is
// enter an average that answers "is the business's SEO working". A filter at write time would
// destroy data to fix a reporting problem, and the next person would have no way to notice.
//
// ⚠️ AND IT IS MATCHED ON THE PAGE, NOT THE QUERY. A rule that guessed which SEARCHES look
// personal would be wrong in both directions — it would drop a real commercial query that happens
// to contain a name, and keep a personal one phrased as a question. The page is a fact; the intent
// behind a query string is an inference.

/**
 * Page paths whose traffic is real but is not a measurement of the business.
 *
 * ⚠️ THE SAME PERSON HAS THREE PAGES ACROSS THREE PROPERTIES, and once the harvest started
 * enumerating properties instead of iterating one row per domain, all three entered our
 * aggregates at once — 3,825 impressions in 28 days with ZERO clicks between them. Excluding one
 * and missing the others would have been worse than excluding none, because the number would look
 * cleaned.
 *
 * ⚠️ Matched on path only, so a path here excludes it on EVERY property. `/sandon-jurowski` is
 * specific enough to be safe; do not add a generic path like `/about` to this list.
 */
export const NON_COMMERCIAL_PAGES: ReadonlyArray<{ path: string; why: string }> = [
  {
    path: '/sites/sandon',
    why: 'Personal page. 613 impressions at position ~7.8, 0 clicks — one of THREE owned results the owner holds on these searches, deliberately kept (see docs/PERSONAL_SEARCH_FOOTPRINT.md).',
  },
  {
    path: '/sandon-jurowski',
    why: 'The same personal page on hivejournal.com — 3,057 impressions at position 3.5, 0 clicks. The largest single non-commercial source in the whole fleet.',
  },
];

/** Hosts serving only a personal page: every path on them is excluded, not just one. */
export const NON_COMMERCIAL_HOSTS: ReadonlyArray<{ host: string; why: string }> = [
  {
    host: 'sandonjurowski.com',
    why: 'Personal exact-match domain. Every path on it is personal by definition.',
  },
];

const pathOf = (pageUrl: string): string => {
  try {
    return new URL(pageUrl).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return (pageUrl || '').split('?')[0].replace(/\/+$/, '') || '/';
  }
};

const hostOf = (pageUrl: string): string => {
  try {
    return new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** True when this page is excluded from fleet aggregates. A row with no page is kept. */
export function isNonCommercialPage(pageUrl: string | null | undefined): boolean {
  if (!pageUrl) return false;
  const h = hostOf(pageUrl);
  if (NON_COMMERCIAL_HOSTS.some((x) => h === x.host)) return true;
  const p = pathOf(pageUrl);
  return NON_COMMERCIAL_PAGES.some((x) => p === x.path || p.startsWith(`${x.path}/`));
}

export function whyExcluded(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null;
  const h = hostOf(pageUrl);
  const byHost = NON_COMMERCIAL_HOSTS.find((x) => h === x.host);
  if (byHost) return byHost.why;
  const p = pathOf(pageUrl);
  return NON_COMMERCIAL_PAGES.find((x) => p === x.path || p.startsWith(`${x.path}/`))?.why ?? null;
}

/**
 * Drop excluded rows from anything that will be averaged, summed or ranked.
 * Returns the kept rows AND what was dropped, because an exclusion nobody can see is the same
 * class of problem as the one this module exists to fix.
 */
export function fleetRows<T extends { page?: string | null }>(
  rows: readonly T[],
): { kept: T[]; excluded: T[] } {
  const kept: T[] = [];
  const excluded: T[] = [];
  for (const r of rows) (isNonCommercialPage(r.page) ? excluded : kept).push(r);
  return { kept, excluded };
}
