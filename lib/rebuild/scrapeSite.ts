// lib/rebuild/scrapeSite.ts
//
// The scraping half of the "AI rebuild" lead magnet: given a prospect's existing
// site URL, fetch it and pull out the raw signals (business name, tagline, body
// copy, nav labels, hero image, brand color) that lib/rebuild/inferSiteSpec.ts
// then hands to the AI to regenerate a QuickSites draft.
//
// This is NOT a fidelity importer — it's a content harvester. The AI cleans up
// whatever we extract, so brittle-but-cheap regex/cheerio parsing is fine.
//
// SECURITY: this fetches an attacker-controllable URL from our server, so it is an
// SSRF surface. assertPublicHttpUrl() blocks non-http(s) schemes and obvious
// internal/loopback/link-local/private hosts + the cloud metadata IP. Residual
// DNS-rebinding risk is noted (we don't re-resolve post-connect); acceptable for a
// best-effort, size/time-capped, read-only harvest that only surfaces text to the
// same user who submitted the URL.

import * as cheerio from 'cheerio';

export type ScrapedSite = {
  sourceUrl: string;
  finalUrl: string;
  businessName: string | null;
  title: string | null;
  description: string | null;
  headings: string[]; // h1/h2 text, de-duped, in document order
  navLabels: string[]; // nav/header link text — strong hint at services/pages
  links: { label: string; href: string }[]; // all in-page links (absolute) — used to find menu subpages
  bodyText: string; // cleaned visible text, truncated (the AI's main input)
  heroImage: string | null; // absolute URL, best-effort
  images: string[]; // other prominent absolute image URLs
  accentColor: string | null; // meta theme-color / obvious brand hex, if any
  structuredData: any[]; // parsed application/ld+json blocks (for product extraction)
  productMeta: { priceAmount?: string; priceCurrency?: string; availability?: string } | null; // og product:* tags
};

export class ScrapeError extends Error {
  code: 'invalid_url' | 'blocked_host' | 'fetch_failed' | 'not_html' | 'too_large';
  constructor(code: ScrapeError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'ScrapeError';
  }
}

const MAX_BYTES = 2_500_000; // 2.5 MB HTML cap
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BODY_CHARS = 6000; // what we forward to the model
const UA =
  'Mozilla/5.0 (compatible; QuickSitesRebuildBot/1.0; +https://quicksites.ai/rebuild)';

/** Reject non-http(s) and hosts that could reach internal infrastructure (SSRF). */
export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new ScrapeError('invalid_url', 'That does not look like a valid URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ScrapeError('invalid_url', 'Only http(s) URLs are supported.');
  }
  const host = u.hostname.toLowerCase();

  // Literal loopback / unspecified / link-local / metadata + common internal names.
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]'
  ) {
    throw new ScrapeError('blocked_host', 'That host is not reachable.');
  }

  // IPv4 literal → block loopback/private/link-local/metadata ranges.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const isPrivate =
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
      (a === 100 && b >= 64 && b <= 127); // carrier-grade NAT
    if (isPrivate) {
      throw new ScrapeError('blocked_host', 'That host is not reachable.');
    }
  }

  // IPv6 literal → block loopback/unique-local/link-local.
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1);
    if (inner === '::1' || inner.startsWith('fc') || inner.startsWith('fd') || inner.startsWith('fe80')) {
      throw new ScrapeError('blocked_host', 'That host is not reachable.');
    }
  }
  return u;
}

/** Fetch + parse a public URL into ScrapedSite. `fetchImpl` is injectable for tests. */
export async function scrapeSite(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ScrapedSite> {
  const u = assertPublicHttpUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(u.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    });
  } catch (e: any) {
    throw new ScrapeError('fetch_failed', `Could not load that site (${e?.message || 'network error'}).`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new ScrapeError('fetch_failed', `That site returned ${res.status}.`);
  }
  const ctype = res.headers.get('content-type') || '';
  if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) {
    throw new ScrapeError('not_html', 'That URL is not an HTML page.');
  }

  const html = await readCapped(res, MAX_BYTES);
  return parseHtml(html, u.toString(), res.url || u.toString());
}

/** Read a response body but bail out past a byte cap. */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > maxBytes * 2) throw new ScrapeError('too_large', 'That page is too large to read.');
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new ScrapeError('too_large', 'That page is too large to read.');
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Pure HTML → ScrapedSite (exported for tests). */
export function parseHtml(html: string, sourceUrl: string, finalUrl: string): ScrapedSite {
  const $ = cheerio.load(html);
  const base = safeUrl(finalUrl) ?? safeUrl(sourceUrl);

  const meta = (name: string) =>
    $(`meta[property="${name}"]`).attr('content') ||
    $(`meta[name="${name}"]`).attr('content') ||
    null;

  const rawTitle = ($('title').first().text() || '').trim() || null;
  const ogSiteName = meta('og:site_name');
  const ogTitle = meta('og:title');
  const description = (meta('description') || meta('og:description') || '').trim() || null;

  const businessName = cleanBusinessName(ogSiteName || ogTitle || rawTitle);

  // Headings (h1/h2), de-duped in order.
  const headings: string[] = [];
  const seenH = new Set<string>();
  $('h1, h2').each((_, el) => {
    const t = collapse($(el).text());
    if (t && t.length <= 140 && !seenH.has(t.toLowerCase())) {
      seenH.add(t.toLowerCase());
      headings.push(t);
    }
  });

  // Nav labels — strong hints at services/sections.
  const navLabels: string[] = [];
  const seenN = new Set<string>();
  $('nav a, header a').each((_, el) => {
    const t = collapse($(el).text());
    if (t && t.length <= 40 && !seenN.has(t.toLowerCase())) {
      seenN.add(t.toLowerCase());
      navLabels.push(t);
    }
  });

  // All in-page links (absolute, deduped) — the raw material for finding menu
  // subpages (restaurant menus usually live on /menus/breakfast etc.).
  const links: { label: string; href: string }[] = [];
  const seenL = new Set<string>();
  $('a[href]').each((_, el) => {
    if (links.length >= 80) return;
    const label = collapse($(el).text());
    const href = absolutize($(el).attr('href'), base);
    if (!href || !label || label.length > 60) return;
    if (seenL.has(href)) return;
    seenL.add(href);
    links.push({ label, href });
  });

  // Structured data (JSON-LD) — parse BEFORE we strip <script>s below. This is how
  // non-Shopify stores (WooCommerce, Squarespace, custom carts) expose Product/Offer
  // data; lib/rebuild/importJsonLd.ts maps it to the same ProductSpec shape.
  const structuredData: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    if (structuredData.length >= 20) return;
    const txt = ($(el).text() || '').trim();
    if (!txt || txt.length > 200_000) return;
    try {
      structuredData.push(JSON.parse(txt));
    } catch {
      /* skip malformed JSON-LD */
    }
  });

  // OpenGraph product meta — a single-product fallback when there's no JSON-LD Product.
  const ogType = (meta('og:type') || '').toLowerCase();
  const priceAmount = meta('product:price:amount') || meta('og:price:amount') || undefined;
  const priceCurrency = meta('product:price:currency') || meta('og:price:currency') || undefined;
  const productMeta =
    ogType.includes('product') || priceAmount
      ? { priceAmount, priceCurrency, availability: meta('product:availability') || undefined }
      : null;

  // Body text — drop non-content nodes, collapse whitespace, truncate.
  $('script, style, noscript, svg, template, iframe').remove();
  const bodyText = collapse($('body').text()).slice(0, MAX_BODY_CHARS);

  // Hero image: og:image first, else the first sizeable-looking <img>.
  const heroImage = absolutize(meta('og:image'), base);
  const images: string[] = [];
  const seenImg = new Set<string>();
  if (heroImage) { images.push(heroImage); seenImg.add(heroImage); }
  $('img').each((_, el) => {
    if (images.length >= 8) return;
    const src = $(el).attr('src') || $(el).attr('data-src');
    const abs = absolutize(src, base);
    if (abs && !seenImg.has(abs) && !/\.svg(\?|$)/i.test(abs)) {
      seenImg.add(abs);
      images.push(abs);
    }
  });

  const accentColor = normalizeHex(meta('theme-color'));

  return {
    sourceUrl,
    finalUrl,
    businessName,
    title: rawTitle,
    description,
    headings: headings.slice(0, 12),
    navLabels: navLabels.slice(0, 16),
    links: links.slice(0, 80),
    bodyText,
    heroImage: heroImage ?? (images[0] ?? null),
    images: images.slice(0, 8),
    accentColor,
    structuredData,
    productMeta,
  };
}

// ---- small pure helpers ----

function collapse(s: string | null | undefined): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/** Strip common "Home | Brand" / "Brand - tagline" chrome to isolate the name. */
export function cleanBusinessName(raw: string | null): string | null {
  if (!raw) return null;
  let s = collapse(raw);
  // Take the segment that looks most like a brand (usually last after a separator).
  const parts = s.split(/\s+[|–—\-·:]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    // Prefer the shortest non-generic segment (brand names tend to be short).
    const generic = /^(home|welcome|official site|homepage)$/i;
    const candidates = parts.filter((p) => !generic.test(p));
    s = (candidates.sort((a, b) => a.length - b.length)[0] || parts[0]).trim();
  }
  s = s.replace(/^(home|welcome to)\s+/i, '').trim();
  return s.slice(0, 80) || null;
}

function safeUrl(u: string): URL | null {
  try { return new URL(u); } catch { return null; }
}

function absolutize(src: string | null | undefined, base: URL | null): string | null {
  if (!src) return null;
  const s = src.trim();
  if (!s || s.startsWith('data:')) return null;
  try {
    return base ? new URL(s, base).toString() : new URL(s).toString();
  } catch {
    return null;
  }
}

/** Links whose label or path smells like a menu / food section. */
const MENU_LINK_RE =
  /menu|breakfast|brunch|lunch|dinner|dessert|drink|wine|beer|cocktail|food|pizza|entree|entrée|appetizer|starter|special|catering/i;

export type MenuPage = { label: string; text: string };

/**
 * Follow up to `maxPages` same-origin menu/food links from a scraped page and
 * return their visible text, so the AI can reconstruct the actual menu (which
 * usually lives on subpages, not the homepage). SSRF-guarded + capped like the
 * primary scrape; best-effort (a failed subpage is skipped, never thrown).
 */
export async function scrapeMenuPages(
  scraped: ScrapedSite,
  fetchImpl: typeof fetch = fetch,
  maxPages = 6,
): Promise<MenuPage[]> {
  const base = safeUrl(scraped.finalUrl) ?? safeUrl(scraped.sourceUrl);
  if (!base) return [];
  const baseHost = base.hostname.replace(/^www\./, '');

  const seenPath = new Set<string>([base.pathname.toLowerCase(), '/']);
  const candidates = scraped.links.filter((l) => {
    let u: URL;
    try { u = new URL(l.href); } catch { return false; }
    if (u.hostname.replace(/^www\./, '') !== baseHost) return false; // same-origin only
    if (!MENU_LINK_RE.test(l.label) && !MENU_LINK_RE.test(u.pathname)) return false;
    const key = u.pathname.toLowerCase();
    if (seenPath.has(key)) return false;
    seenPath.add(key);
    return true;
  }).slice(0, maxPages);

  const out: MenuPage[] = [];
  for (const c of candidates) {
    try {
      const u = assertPublicHttpUrl(c.href);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetchImpl(u.toString(), {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      const ctype = res.headers.get('content-type') || '';
      if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) continue;
      const html = await readCapped(res, MAX_BYTES);
      const page = parseHtml(html, c.href, res.url || c.href);
      if (page.bodyText) out.push({ label: c.label, text: page.bodyText });
    } catch {
      continue; // skip a bad subpage
    }
  }
  return out;
}

function normalizeHex(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = v.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex.toLowerCase()}`;
}
