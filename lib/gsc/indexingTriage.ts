// lib/gsc/indexingTriage.ts
//
// Turn one Search Console URL Inspection result into a decision: is this page indexed, is the
// reported state EXPECTED (our own redirects and canonicals, working as designed), is it something
// WE can fix in code, or does it need a person? Pure, so the rules are testable and the admin page
// and the cron cannot disagree.
//
// ⚠️ THE BUCKETS ARE THE POINT. A list of Google's reason labels is what the emails already give
// us, and it is unactionable because "Page with redirect" on an apex that redirects to www is
// correct, while "Duplicate, Google chose different canonical than user" on a platform copy is a
// bug we shipped. Same inbox, opposite meanings. Each rule below names the remedy, or says there
// is none for us to apply.
//
// Coverage-state strings are Google's and are matched loosely (lower-case, substring) because
// they are prose, not an enum, and have changed wording before.

export type TriageBucket = 'indexed' | 'expected' | 'auto_fixable' | 'needs_person' | 'unknown';

export type InspectionFacts = {
  url: string;
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  userCanonical: string | null;
  googleCanonical: string | null;
  lastCrawlTime: string | null;
  crawledAs: string | null;
};

export type Triage = { bucket: TriageBucket; reason: string; remedy: string | null };

/** Pull the fields we keep out of Google's `inspectionResult.indexStatusResult`. Never guesses. */
export function parseInspection(url: string, raw: unknown): InspectionFacts {
  const r = (raw as { inspectionResult?: { indexStatusResult?: Record<string, unknown> } } | null)?.inspectionResult?.indexStatusResult ?? {};
  const s = (k: string): string | null => (typeof r[k] === 'string' && (r[k] as string).trim() ? (r[k] as string).trim() : null);
  return {
    url,
    verdict: s('verdict'),
    coverageState: s('coverageState'),
    indexingState: s('indexingState'),
    robotsTxtState: s('robotsTxtState'),
    pageFetchState: s('pageFetchState'),
    userCanonical: s('userCanonical'),
    googleCanonical: s('googleCanonical'),
    lastCrawlTime: s('lastCrawlTime'),
    crawledAs: s('crawledAs'),
  };
}

/** `https://www.Foo.com/bar/` and `https://www.foo.com/bar` are the same address. */
export function sameUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (u: string | null | undefined) => {
    if (!u) return '';
    try {
      const x = new URL(u);
      const path = x.pathname.replace(/\/+$/, '') || '/';
      return `${x.protocol}//${x.host.toLowerCase()}${path}`;
    } catch {
      return u.trim().toLowerCase().replace(/\/+$/, '');
    }
  };
  const na = norm(a);
  return !!na && na === norm(b);
}

export function triageInspection(
  f: InspectionFacts,
  opts: {
    declaredCanonical?: string | null;
    /**
     * HTTP status of the URL fetched by US, right now. Google's coverage state describes its LAST
     * crawl, which can be months old: murfreesboro-towing.com read "Not found (404)" from a crawl
     * two months earlier while serving 200 today. A fetch failure Google reports that we cannot
     * reproduce is "awaiting recrawl", not a bug to fix.
     */
    liveStatus?: number | null;
    /**
     * True when the canonical Google chose now REDIRECTS to the one we declare (checked live by
     * the cron). cullmantow.com: Google chose the apex from a 2026-09-24 crawl; the apex has since
     * 307'd to www, which self-canonicalises. Nothing left to fix — Google has to recrawl.
     */
    googleCanonicalRedirectsToDeclared?: boolean;
  } = {},
): Triage {
  const cov = (f.coverageState ?? '').toLowerCase();
  const verdict = (f.verdict ?? '').toUpperCase();
  const declared = opts.declaredCanonical ?? null;
  const liveOk = opts.liveStatus === 200;
  const stale = (what: string): Triage => ({
    bucket: 'expected',
    reason: `${what} at Google's last crawl${f.lastCrawlTime ? ` (${f.lastCrawlTime.slice(0, 10)})` : ''} — serves 200 now, awaiting recrawl`,
    remedy: null,
  });

  if (verdict === 'PASS' || /submitted and indexed|^indexed/.test(cov)) {
    return { bucket: 'indexed', reason: f.coverageState ?? 'Indexed', remedy: null };
  }

  if (cov.includes('page with redirect')) {
    // Our apex→www and http→https hops. Expected, and the redirect target is what gets indexed.
    return { bucket: 'expected', reason: 'Page with redirect', remedy: null };
  }

  if (cov.includes('alternate page with proper canonical')) {
    if (!declared || sameUrl(f.googleCanonical, declared)) {
      return { bucket: 'expected', reason: 'Alternate page with proper canonical tag', remedy: null };
    }
    return {
      bucket: 'auto_fixable',
      reason: 'Alternate page, but Google consolidated to a different canonical than we nominate',
      remedy: `Google canonical ${f.googleCanonical ?? '?'} vs nominated ${declared}: re-run scripts/nominate-custom-domain-canonicals.mjs after checking the domain serves this page.`,
    };
  }

  if (cov.includes('duplicate')) {
    if (cov.includes('google chose different canonical')) {
      if (declared && sameUrl(f.googleCanonical, declared)) {
        // We now nominate exactly what Google chose; this clears on the next crawl.
        return { bucket: 'expected', reason: 'Duplicate — Google already uses the canonical we now nominate (awaiting recrawl)', remedy: null };
      }
      if (opts.googleCanonicalRedirectsToDeclared) {
        return { bucket: 'expected', reason: "Duplicate — Google's chosen canonical now redirects to ours (awaiting recrawl)", remedy: null };
      }
      return {
        bucket: 'auto_fixable',
        reason: 'Duplicate, Google chose different canonical than user',
        remedy: `Declared ${f.userCanonical ?? '(none)'}, Google chose ${f.googleCanonical ?? '?'}. Nominate one host (scripts/nominate-custom-domain-canonicals.mjs) and make every copy point at it.`,
      };
    }
    return {
      bucket: 'auto_fixable',
      reason: f.coverageState ?? 'Duplicate without user-selected canonical',
      remedy: 'No canonical declared on a page that exists at several addresses — nominate a host (scripts/nominate-custom-domain-canonicals.mjs).',
    };
  }

  if (cov.includes('noindex')) {
    return {
      bucket: 'needs_person',
      reason: "Excluded by 'noindex' tag",
      remedy: 'This URL was inspected because we list it as published; a noindex on it is either an unclaimed draft that should not be in the list or a flag to clear. Decide which.',
    };
  }

  if (cov.includes('blocked by robots')) {
    return { bucket: 'auto_fixable', reason: 'Blocked by robots.txt', remedy: 'A published page must not be disallowed; check robots.txt for this host.' };
  }

  if (cov.includes('not found') || (f.pageFetchState ?? '').toUpperCase().includes('NOT_FOUND')) {
    if (liveOk) return stale('Not found (404)');
    return { bucket: 'auto_fixable', reason: 'Not found (404)', remedy: 'A URL we list that we do not serve — fix the page path or drop it from the sitemap.' };
  }

  if (cov.includes('soft 404')) {
    return { bucket: 'needs_person', reason: 'Soft 404', remedy: 'Google sees an empty or placeholder page. The page needs real content, not a setting.' };
  }

  if (cov.includes('server error') || (f.pageFetchState ?? '').toUpperCase().includes('SERVER_ERROR')) {
    if (liveOk) return stale('Server error (5xx)');
    return { bucket: 'auto_fixable', reason: 'Server error (5xx)', remedy: 'The page failed to render for Googlebot; reproduce with curl -A Googlebot and fix the render.' };
  }

  if (cov.includes('access forbidden') || (f.pageFetchState ?? '').toUpperCase().includes('ACCESS_DENIED')) {
    if (liveOk) return stale('Access forbidden (403)');
    return { bucket: 'auto_fixable', reason: 'Blocked due to access forbidden (403)', remedy: 'Something between Googlebot and the page answers 403; check host-level protection on this domain.' };
  }

  if (cov.includes('crawled - currently not indexed') || cov.includes('crawled – currently not indexed')) {
    return {
      bucket: 'needs_person',
      reason: 'Crawled - currently not indexed',
      remedy: "Google's quality verdict on a thin page. Not a setting: the page needs content a searcher would want, or it stays out.",
    };
  }

  if (cov.includes('discovered - currently not indexed') || cov.includes('discovered – currently not indexed')) {
    return {
      bucket: 'needs_person',
      reason: 'Discovered - currently not indexed',
      remedy: 'Google knows the URL and has chosen not to fetch it yet; usually crawl budget or low perceived value. Internal links to it and real content help; nothing in a setting does.',
    };
  }

  if (cov.includes('unknown to google')) {
    return { bucket: 'expected', reason: 'URL is unknown to Google', remedy: 'Not yet discovered — make sure it is in the sitemap and wait.' };
  }

  if (verdict === 'FAIL') {
    return { bucket: 'needs_person', reason: f.coverageState ?? 'Verdict FAIL', remedy: 'Google reports a failing state this triage has no rule for; read the inspection raw result.' };
  }

  return { bucket: 'unknown', reason: f.coverageState ?? f.verdict ?? 'No coverage state reported', remedy: null };
}

export const BUCKET_LABEL: Record<TriageBucket, string> = {
  indexed: 'Indexed',
  expected: 'Expected — working as designed',
  auto_fixable: 'Fixable by us',
  needs_person: 'Needs a person',
  unknown: 'Unclassified',
};

/** Order for display and for "what matters most". */
export const BUCKET_ORDER: TriageBucket[] = ['auto_fixable', 'needs_person', 'unknown', 'expected', 'indexed'];
