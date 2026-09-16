// lib/rebuild/renderedCatalog.ts
//
// Fourth rung of the product-import ladder: RENDER the store in a real browser and read the
// product cards off the page as a visitor sees them.
//
// Rungs 1–3 (Shopify /products.json, homepage JSON-LD/OG, product-subpage JSON-LD) all read
// static HTML. A whole class of storefronts — Shoptop, HiCustom, most Chinese cross-border SaaS,
// and any SPA — ship an empty shell and draw the catalog with JavaScript, so those rungs return
// nothing and the draft got an empty Shop block with a "couldn't read the catalog" note. The
// first white-label partner's two rebuilds were both in that class (2026-09-16).
//
// This rung reuses the headless Chromium that lib/verify/render.ts already runs on Vercel for
// the claim-verification probe (@sparticuz/chromium + puppeteer-core; Playwright locally). The
// page-side script scrolls to trigger lazy images, then finds product CARDS by shape: a link
// whose path looks like a product, inside a container that holds an image and a price. No
// platform-specific selectors — the shape is the same on every cart we have looked at.
//
// ⚠️ WHAT IS READ IS WHAT IS SHOWN. A card's title and price are the store's own published
// claims, copied verbatim (a "from ¥21.01" stays a from-price). Nothing is inferred and nothing
// is priced by us. When the page shows a broken image (HiCustom's cards literally carry
// src="undefined/"), the product imports with NO image rather than a guessed one.
//
// ⚠️ CURRENCY IS PART OF THE PRICE. The catalog pipeline stores integer minor units against the
// merchant's currency (USD by default), so a ¥21.01 card provisioned as-is would sell for
// $21.01. The route provisions purchasable items only when every product's currency matches
// the merchant's; otherwise the products stay a DISPLAY-ONLY snapshot on the grid (the "product
// gallery" — real products, real prices, no cart) until the owner sets a currency.

import { renderEvaluate } from '@/lib/verify/render';
import type { ProductSpec } from '@/lib/rebuild/importShopify';
import type { ScrapedSite } from '@/lib/rebuild/scrapeSite';

/** Opt-out flag: rendering is ON unless explicitly disabled (no keys to be incomplete). */
export function renderedCatalogEnabled(): boolean {
  const v = String(process.env.REBUILD_BROWSER_CATALOG_ENABLED ?? '').toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}

export type RenderedCard = {
  href: string;
  title: string;
  priceText: string;
  image: string | null;
};

export type CatalogExtract = {
  lang: string;
  anchors: number;
  cards: RenderedCard[];
};

/**
 * Page-side extractor. Evaluated raw in two Chromium builds, so: ES5-ish, no bundler, no
 * template literals, returns a promise (both drivers await it).
 */
export const CATALOG_EXTRACT_JS = `(function () {
  var PRICE = /(?:¥|￥|HK\\$|NT\\$|US\\$|S\\$|A\\$|C\\$|RM|\\$|€|£|₩|₹|USD|CNY|RMB|EUR|GBP|JPY|HKD)\\s?\\d{1,3}(?:[,.]\\d{3})*(?:[.,]\\d{1,2})?|\\d{1,3}(?:[,.]\\d{3})*(?:[.,]\\d{1,2})?\\s?(?:元|USD|CNY|EUR|GBP|JPY|HKD)/;
  var HREF = /\\/(?:products?|goods|item|items|productType|detail|spu|sku|commodity)(?:\\/|\\?|$)|(?:goods|product|spu|sku|item)_?id=|\\/p\\/[^/]+$/i;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clean(s) { return (s || '').replace(/\\s+/g, ' ').trim(); }
  function imgOf(el) {
    var imgs = el.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var srcset = (img.getAttribute('srcset') || '').split(',')[0] || '';
      var cands = [img.currentSrc, img.getAttribute('src'), img.getAttribute('data-src'), img.getAttribute('data-original'), img.getAttribute('data-lazy'), srcset.trim().split(' ')[0]];
      for (var j = 0; j < cands.length; j++) {
        var c = cands[j];
        if (!c) continue;
        if (/undefined|null|data:image\\/svg|\\.svg(\\?|$)|placeholder|no-data|blank\\./i.test(c)) continue;
        if (/^https?:\\/\\//.test(c)) return c;
        if (/^\\/\\//.test(c)) return 'https:' + c;
        if (/^\\//.test(c)) return location.origin + c;
      }
    }
    var all = el.querySelectorAll('*');
    for (var k = 0; k < all.length && k < 40; k++) {
      var bg = getComputedStyle(all[k]).backgroundImage;
      var m = /url\\(["']?(https?:[^"')]+)["']?\\)/.exec(bg || '');
      if (m && !/undefined|\\.svg/i.test(m[1])) return m[1];
    }
    return null;
  }
  function sameSite(href) {
    try {
      var h = new URL(href, location.href).hostname.split('.').slice(-2).join('.');
      var mine = location.hostname.split('.').slice(-2).join('.');
      return h === mine;
    } catch (e) { return false; }
  }
  return (async function () {
    // Navigation resolves on DOMContentLoaded (a store with analytics beacons never reaches
    // network-idle), so hydration + the first catalog fetch settle HERE, then the scroll
    // triggers lazy images. ~4s total, bounded, the same in both drivers.
    await sleep(1800);
    for (var y = 0; y < 4000; y += 700) { window.scrollTo(0, y); await sleep(250); }
    window.scrollTo(0, 0);
    await sleep(600);
    var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href]')).filter(function (a) {
      var h = a.getAttribute('href') || '';
      return HREF.test(h) && sameSite(a.href);
    });
    var seen = {};
    var cards = [];
    for (var i = 0; i < anchors.length && cards.length < 40; i++) {
      var a = anchors[i];
      var href = a.href;
      if (seen[href]) continue;
      seen[href] = 1;
      var el = a;
      for (var d = 0; d < 3 && el; d++) {
        if (el.querySelector('img') && PRICE.test(el.innerText || '')) break;
        el = el.parentElement;
      }
      if (!el) continue;
      var text = clean(el.innerText);
      var pm = PRICE.exec(text);
      if (!pm) continue;
      var title = clean(text.slice(0, pm.index)).replace(/[\\-–—|·:]+$/, '').trim();
      if (!title) {
        var alt = el.querySelector('img') && el.querySelector('img').getAttribute('alt');
        title = clean(alt);
      }
      if (!title || title.length < 2) continue;
      cards.push({ href: href, title: title.slice(0, 200), priceText: clean(text.slice(pm.index, pm.index + 40)), image: imgOf(el) });
    }
    return { lang: (document.documentElement.lang || '').toLowerCase(), anchors: anchors.length, cards: cards };
  })();
})()`;

/* ---------- pure mapping (tested) ---------- */

const SYMBOL_CURRENCY: ReadonlyArray<readonly [RegExp, string]> = [
  [/^HK\$/i, 'HKD'],
  [/^NT\$/i, 'TWD'],
  [/^US\$/i, 'USD'],
  [/^S\$/i, 'SGD'],
  [/^A\$/i, 'AUD'],
  [/^C\$/i, 'CAD'],
  [/^RM/i, 'MYR'],
  [/^\$/, 'USD'],
  [/^€/, 'EUR'],
  [/^£/, 'GBP'],
  [/^₩/, 'KRW'],
  [/^₹/, 'INR'],
  [/^(USD|CNY|RMB|EUR|GBP|JPY|HKD)/i, ''], // resolved below from the code itself
];

/**
 * "￥21.01起" → { cents: 2101, currency: 'CNY', from: true }. Pure.
 * ¥/￥ read as CNY unless the page declares Japanese; "元" is CNY; a bare "$" is USD.
 * Returns null when no amount can be read — a product without a price is not imported.
 */
export function parsePriceText(
  raw: string,
  lang = '',
): { cents: number; currency: string; from: boolean } | null {
  const s = (raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const from = /起|from|ab\b|à partir|desde/i.test(s);

  let currency: string | null = null;
  let rest = s;
  if (/^[¥￥]/.test(s)) {
    currency = /^ja\b/.test(lang) ? 'JPY' : 'CNY';
    rest = s.slice(1);
  } else {
    for (const [re, code] of SYMBOL_CURRENCY) {
      const m = re.exec(s);
      if (!m) continue;
      currency = code || m[0].toUpperCase().replace('RMB', 'CNY');
      rest = s.slice(m[0].length);
      break;
    }
  }
  const num = /(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/.exec(rest);
  if (!num) return null;
  if (!currency) {
    const trail = rest.slice((num.index ?? 0) + num[0].length);
    const code = /^\s?(元|USD|CNY|EUR|GBP|JPY|HKD)/i.exec(trail)?.[1];
    if (!code) return null; // an amount with no currency is not a price we can quote
    currency = code === '元' ? 'CNY' : code.toUpperCase();
  }
  // "1,299.00" / "1.299,00" / "21.01" — the last separator is the decimal point when it has
  // 1–2 digits after it; otherwise it is a thousands separator.
  let n = num[0];
  const lastSep = Math.max(n.lastIndexOf('.'), n.lastIndexOf(','));
  if (lastSep >= 0 && n.length - lastSep - 1 <= 2) {
    n = n.slice(0, lastSep).replace(/[.,]/g, '') + '.' + n.slice(lastSep + 1);
  } else {
    n = n.replace(/[.,]/g, '');
  }
  const value = Number(n);
  if (!Number.isFinite(value) || value < 0) return null;
  const zeroDecimal = currency === 'JPY' || currency === 'KRW';
  return { cents: Math.round(value * (zeroDecimal ? 1 : 100)), currency, from };
}

function handleFromHref(href: string, title: string): string {
  try {
    const u = new URL(href);
    const id = u.searchParams.get('id') || u.searchParams.get('goods_id') || u.searchParams.get('product_id') || u.searchParams.get('spu_id');
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    const base = (id ? `${last || 'item'}-${id}` : last) || title;
    return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'item';
  } catch {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'item';
  }
}

/** Rendered cards → ProductSpec[] (deduped by handle, priceless cards dropped). Pure. */
export function cardsToProducts(cards: RenderedCard[], lang = ''): ProductSpec[] {
  const out: ProductSpec[] = [];
  const seen = new Set<string>();
  for (const c of cards ?? []) {
    const title = (c.title || '').trim();
    if (!title) continue;
    const price = parsePriceText(c.priceText, lang);
    if (!price) continue;
    const handle = handleFromHref(c.href, title);
    if (seen.has(handle)) continue;
    seen.add(handle);
    const image = typeof c.image === 'string' && /^https?:\/\//.test(c.image) && !/undefined/i.test(c.image) ? c.image : null;
    out.push({
      title: title.slice(0, 200),
      handle,
      description: '',
      priceCents: price.cents,
      currency: price.currency,
      priceFrom: price.from,
      images: image ? [image] : [],
      variants: [{ title: 'Default', priceCents: price.cents }],
      options: [],
      requiresShipping: true,
      productUrl: c.href || null,
    });
    if (out.length >= 40) break;
  }
  return out;
}

/* ---------- orchestration ---------- */

/** Listing-ish links worth rendering when the homepage shows no cards. Pure; exported for tests. */
export function pickListingCandidates(scraped: Pick<ScrapedSite, 'finalUrl' | 'sourceUrl' | 'links'>, max = 2): string[] {
  let base: URL;
  try {
    base = new URL(scraped.finalUrl || scraped.sourceUrl);
  } catch {
    return [];
  }
  const host = base.hostname.replace(/^www\./, '');
  const RE = /\/(?:collections?|products?|shop|store|goods|all-?goods|productType|catalog|categor(?:y|ies))(?:\/|\?|$)|\/pages\/[^/]*(?:select|shop|product|store|goods|catalog)[^/]*/i;
  const seen = new Set<string>([base.pathname.toLowerCase() || '/']);
  const out: string[] = [];
  for (const l of scraped.links ?? []) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, '') !== host) continue;
    if (/javascript:/i.test(u.pathname + u.search)) continue;
    const key = (u.pathname + u.search).toLowerCase();
    if (seen.has(key) || !RE.test(u.pathname)) continue;
    seen.add(key);
    out.push(u.toString());
    if (out.length >= max) break;
  }
  return out;
}

export type RenderedCatalogResult = {
  products: ProductSpec[];
  rendered: string[];
  driver: 'playwright' | 'serverless' | 'none';
  error?: string;
};

/**
 * Render the homepage (then up to two listing pages if it shows no cards) and read the product
 * cards. Bounded by `budgetMs` overall; best-effort — a render failure is REPORTED in the
 * result, never thrown, and never mistaken for "no products".
 */
export async function importRenderedCatalog(
  scraped: ScrapedSite,
  opts: { budgetMs?: number; prefer?: 'playwright' | 'serverless'; renderer?: typeof renderEvaluate } = {},
): Promise<RenderedCatalogResult> {
  const budgetMs = opts.budgetMs ?? 40_000;
  const render = opts.renderer ?? renderEvaluate;
  const started = Date.now();
  const rendered: string[] = [];
  let driver: RenderedCatalogResult['driver'] = 'none';
  let lastError: string | undefined;

  const urls = [scraped.finalUrl || scraped.sourceUrl, ...pickListingCandidates(scraped)];
  for (const url of urls) {
    const left = budgetMs - (Date.now() - started);
    if (left < 8_000) break;
    // ⚠️ domcontentloaded, not network-idle: hicustom.com's beacons never go quiet and the
    // production function timed out at 30s with Chromium perfectly healthy. The page-side
    // script does its own settling.
    const r = await render<CatalogExtract>(url, CATALOG_EXTRACT_JS, {
      prefer: opts.prefer,
      timeoutMs: Math.min(25_000, left - 3_000),
      waitUntil: 'domcontentloaded',
    });
    rendered.push(url);
    if (!r.ok) {
      lastError = r.error;
      driver = r.driver;
      // A launch failure will not fix itself on the next URL.
      if (/executablePath|launch|spawn|ENOENT|Cannot find module/i.test(r.error)) break;
      continue;
    }
    driver = r.driver;
    const products = cardsToProducts(r.value?.cards ?? [], r.value?.lang ?? '');
    if (products.length) return { products, rendered, driver };
  }
  return { products: [], rendered, driver, ...(lastError ? { error: lastError } : {}) };
}
