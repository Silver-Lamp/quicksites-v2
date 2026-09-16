// lib/rebuild/importProductPages.ts
//
// Third rung of the product-import ladder, after Shopify /products.json (exact) and the
// homepage's own JSON-LD / OpenGraph product meta (lib/rebuild/importJsonLd.ts):
//
//   follow a few same-origin PRODUCT and COLLECTION links from the scraped page and read the
//   schema.org Product JSON-LD / og product meta on each of THOSE pages.
//
// Why a third rung: nearly every non-Shopify cart (WooCommerce, Squarespace, BigCommerce, the
// SSR'd Shopify look-alikes) emits Product JSON-LD on the product PAGE and only Organization /
// WebSite on the homepage — so the homepage-only fallback found nothing on most real stores. The
// restaurant path learned the same lesson (menus live on subpages; scrapeMenuPages), and this is
// its sibling for shops.
//
// Deterministic, no AI. Best-effort: a bad subpage is skipped, never thrown. Capped in pages,
// bytes, and time, and SSRF-guarded like every other fetch in this directory.
//
// What it does NOT do: render JavaScript. A store whose product pages are client-rendered (Shoptop,
// as FOYTEA was on 2026-09-15) yields nothing here; detection (storefrontDetect) still fires so the
// draft carries an empty Shop block and the gap is reported rather than hidden.

import { assertPublicHttpUrl, parseHtml, readCapped, type ScrapedSite } from '@/lib/rebuild/scrapeSite';
import { productsFromScrape } from '@/lib/rebuild/importJsonLd';
import type { ProductSpec } from '@/lib/rebuild/importShopify';

const MAX_BYTES = 2_500_000;
// Shorter than the primary scrape: the crawl runs beside the AI call inside the route's 60s
// budget (8 pages, 4 at a time → worst case 2 × timeout).
const FETCH_TIMEOUT_MS = 8_000;
const MAX_PRODUCTS = 60;
const CONCURRENCY = 4;
const UA = 'Mozilla/5.0 (compatible; QuickSitesRebuildBot/1.0; +https://quicksites.ai/rebuild)';

/** A path that names ONE product (…/products/<handle>, …/product/<slug>, …/item/<id>, …/p/<slug>). */
export const PRODUCT_PAGE_RE = /\/(?:products?|item|items|p)\/[^/?#]+\/?$/i;
/** A listing page (collection / category / shop index) — often carries an ItemList of Products. */
export const COLLECTION_PAGE_RE = /\/(?:collections?|categor(?:y|ies)|shop|store)(?:\/[^/?#]+)?\/?$/i;

/** Pick the same-origin product links first, then collection links, up to `maxPages`. Pure. */
export function pickProductPageCandidates(
  scraped: Pick<ScrapedSite, 'finalUrl' | 'sourceUrl' | 'links'>,
  maxPages: number,
): string[] {
  let base: URL;
  try {
    base = new URL(scraped.finalUrl || scraped.sourceUrl);
  } catch {
    return [];
  }
  const baseHost = base.hostname.replace(/^www\./, '');
  const seen = new Set<string>([base.pathname.toLowerCase() || '/', '/']);

  const products: string[] = [];
  const collections: string[] = [];
  for (const l of scraped.links ?? []) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, '') !== baseHost) continue; // same-origin only
    const key = u.pathname.toLowerCase();
    if (seen.has(key)) continue;
    if (PRODUCT_PAGE_RE.test(u.pathname)) {
      seen.add(key);
      products.push(u.toString());
    } else if (COLLECTION_PAGE_RE.test(u.pathname)) {
      seen.add(key);
      collections.push(u.toString());
    }
  }
  return [...products, ...collections].slice(0, maxPages);
}

async function fetchPage(url: string, fetchImpl: typeof fetch): Promise<ScrapedSite | null> {
  const u = assertPublicHttpUrl(url);
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
  if (!res.ok) return null;
  const ctype = res.headers.get('content-type') || '';
  if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) return null;
  const html = await readCapped(res, MAX_BYTES);
  return parseHtml(html, url, res.url || url);
}

/**
 * Follow up to `maxPages` product/collection subpages and return the products their structured
 * data describes, de-duplicated by handle. `fetchImpl` is injectable for tests.
 */
export async function scrapeProductPages(
  scraped: ScrapedSite,
  fetchImpl: typeof fetch = fetch,
  maxPages = 8,
): Promise<ProductSpec[]> {
  const candidates = pickProductPageCandidates(scraped, maxPages);
  if (!candidates.length) return [];

  const out: ProductSpec[] = [];
  const seen = new Set<string>();
  const add = (list: ProductSpec[]) => {
    for (const p of list) {
      if (out.length >= MAX_PRODUCTS) return;
      if (seen.has(p.handle)) continue;
      seen.add(p.handle);
      out.push(p);
    }
  };

  // Bounded concurrency so a slow store cannot hold the request for maxPages × timeout.
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(
      batch.map((url) => fetchPage(url, fetchImpl).catch(() => null)),
    );
    for (const page of pages) {
      if (!page) continue;
      add(productsFromScrape(page));
      if (out.length >= MAX_PRODUCTS) return out;
    }
  }
  return out;
}
