// lib/rebuild/siteFreshness.ts
//
// The "dated site" scorer for the lead-gen fan-out. Given a business's existing site
// URL, fetch it and score how modern it looks (0–100). A low score → a strong pitch
// ("your site isn't mobile-friendly / hasn't been touched since 2011"). No paid API —
// this replaces reaching for Ahrefs, which can't fan out geographically anyway.
//
// SSRF-guarded via assertPublicHttpUrl (shared with scrapeSite.ts). Best-effort: any
// fetch/parse failure resolves to tier 'has_site' so an unreachable site isn't
// mis-sold as a stale-site lead.

import * as cheerio from 'cheerio';
import { assertPublicHttpUrl } from '@/lib/rebuild/scrapeSite';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_CHARS = 1_500_000;
const UA = 'Mozilla/5.0 (compatible; QuickSitesFreshnessBot/1.0; +https://quicksites.ai/rebuild)';

export type FreshnessResult = {
  score: number; // 0–100
  tier: 'dated' | 'has_site';
  signals: string[]; // human-readable negatives found (for the pitch / UI)
  reachable: boolean;
};

// Each negative signal deducts from a starting score of 100.
const DEDUCTIONS = {
  noViewport: 30, // not mobile-responsive — the single biggest tell
  notHttps: 25,
  legacyGenerator: 20,
  tableLayout: 15,
  staleCopyright: 15,
  noOpenGraph: 10,
} as const;

const LEGACY_GENERATOR_RE =
  /frontpage|dreamweaver|adobe\s*muse|wix\s*(?:free|classic)?|geocities|homestead|godaddy\s*website\s*builder|microsoft\s*word|wordpress\s*[1-4]\./i;

/**
 * Pure scorer over already-fetched HTML. `now` is injectable so the stale-copyright
 * check is deterministic in tests. Exported for unit testing.
 */
export function scoreFreshnessFromHtml(
  html: string,
  finalUrl: string,
  now: Date = new Date(),
  datedThreshold = 55,
): Omit<FreshnessResult, 'reachable'> {
  const $ = cheerio.load(html);
  const signals: string[] = [];
  let score = 100;

  // 1) Mobile viewport meta — its absence means a fixed-width desktop-only layout.
  const hasViewport = $('meta[name="viewport"]').length > 0;
  if (!hasViewport) {
    score -= DEDUCTIONS.noViewport;
    signals.push('No mobile viewport (not responsive)');
  }

  // 2) HTTPS.
  let isHttps = false;
  try {
    isHttps = new URL(finalUrl).protocol === 'https:';
  } catch {
    /* leave false */
  }
  if (!isHttps) {
    score -= DEDUCTIONS.notHttps;
    signals.push('Not served over HTTPS');
  }

  // 3) Legacy site-builder / generator fingerprint.
  const generator = ($('meta[name="generator"]').attr('content') || '').trim();
  if (generator && LEGACY_GENERATOR_RE.test(generator)) {
    score -= DEDUCTIONS.legacyGenerator;
    signals.push(`Built with a dated tool (${generator.slice(0, 40)})`);
  }

  // 4) Table-based layout / <font> tags — the hallmark of pre-CSS-era sites.
  const tableCount = $('table').length;
  const fontTags = $('font').length;
  if (tableCount >= 3 || fontTags > 0) {
    score -= DEDUCTIONS.tableLayout;
    signals.push('Table-based / pre-CSS layout');
  }

  // 5) Stale copyright year in footer/body text.
  const currentYear = now.getFullYear();
  const bodyText = $('body').text();
  let newestYear = 0;
  const yearRe = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi;
  let m: RegExpExecArray | null;
  while ((m = yearRe.exec(bodyText)) !== null) {
    const y = Number(m[1]);
    if (y >= 1995 && y <= currentYear && y > newestYear) newestYear = y;
  }
  if (newestYear && currentYear - newestYear >= 3) {
    score -= DEDUCTIONS.staleCopyright;
    signals.push(`Copyright stuck at ${newestYear}`);
  }

  // 6) No Open Graph tags — no modern social/share metadata.
  const hasOg = $('meta[property^="og:"]').length > 0;
  if (!hasOg) {
    score -= DEDUCTIONS.noOpenGraph;
    signals.push('No Open Graph / social metadata');
  }

  score = Math.max(0, Math.min(100, score));
  return { score, tier: score < datedThreshold ? 'dated' : 'has_site', signals };
}

/**
 * Fetch + score a business's existing site. Never throws — a failure to load resolves
 * to { tier:'has_site', reachable:false } so we don't classify an unreachable site as
 * a dated-site lead. `fetchImpl` is injectable for tests.
 */
export async function scoreSiteFreshness(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FreshnessResult> {
  let u: URL;
  try {
    u = assertPublicHttpUrl(url);
  } catch {
    return { score: 100, tier: 'has_site', signals: [], reachable: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(u.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return { score: 100, tier: 'has_site', signals: [], reachable: false };
    const ctype = res.headers.get('content-type') || '';
    if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) {
      return { score: 100, tier: 'has_site', signals: [], reachable: false };
    }
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    const scored = scoreFreshnessFromHtml(html, res.url || u.toString());
    return { ...scored, reachable: true };
  } catch {
    return { score: 100, tier: 'has_site', signals: [], reachable: false };
  } finally {
    clearTimeout(timer);
  }
}
