// lib/rebuild/importShopify.ts
//
// Deterministic Shopify store importer for the "AI rebuild" pipeline. Unlike the
// AI harvest (scrapeSite + inferSiteSpec), this pulls EXACT product data — title,
// price, compare-at, description, variants, and every product image — straight from
// Shopify's public, unauthenticated `/products.json` endpoint. No AI, no cost, no
// guessing: a Shopify store hands us its catalog as clean JSON.
//
// This is the load-bearing half of "replicate a Shopify site": the products become
// real QuickSites catalog_items (purchasable via the existing cart/checkout) and the
// product photos + copy fill the storefront blocks, instead of the generic
// services-brochure the AI path produced.
//
// SECURITY: same SSRF surface as scrapeSite — we fetch an attacker-controllable URL
// server-side. Reuses assertPublicHttpUrl() to block internal/loopback hosts, and
// size/time-caps the fetch. Best-effort: any failure returns no products, never throws.

import { assertPublicHttpUrl, ScrapeError } from '@/lib/rebuild/scrapeSite';

const PRODUCTS_JSON_CAP = 4_000_000; // 4 MB JSON cap (catalogs can be large)
const FETCH_TIMEOUT_MS = 12_000;
const MAX_PRODUCTS = 60; // don't import an entire 10k-SKU catalog into one draft
const MAX_IMAGES_PER_PRODUCT = 10;
const UA =
  'Mozilla/5.0 (compatible; QuickSitesRebuildBot/1.0; +https://quicksites.ai/rebuild)';

export type ProductVariantSpec = {
  title: string; // "Default Title" or "Large / Blue"
  priceCents: number;
  compareAtCents?: number;
  sku?: string;
  available?: boolean;
  grams?: number; // shipping weight, for weight-based shipping
  options?: string[]; // option1/2/3 values, blanks dropped
};

export type ProductSpec = {
  title: string;
  handle: string;
  description: string; // plain text (from body_html)
  productType?: string;
  vendor?: string;
  priceCents: number; // representative (lowest variant) price
  compareAtCents?: number; // representative compare-at, if any
  currency: string; // ISO code; Shopify products.json omits it, defaults USD
  images: string[]; // absolute CDN image URLs
  variants: ProductVariantSpec[];
  options: { name: string; values: string[] }[];
  requiresShipping: boolean;
  grams?: number; // representative shipping weight (cheapest variant)
  productUrl: string | null; // <origin>/products/<handle>
};

/** Cheap detection from already-fetched HTML — avoids an extra request when a site
 *  is obviously not Shopify. Callers can still attempt the import directly. */
export function detectShopifyFromHtml(html: string): boolean {
  if (!html) return false;
  return (
    /cdn\.shopify\.com/i.test(html) ||
    /Powered by Shopify/i.test(html) ||
    /Shopify\.theme|window\.Shopify|ShopifyAnalytics/i.test(html) ||
    /<meta[^>]+shopify-(?:digital-wallet|checkout)/i.test(html)
  );
}

/** Dollars string ("29.99") → integer cents (2999). Null/blank/NaN → undefined. */
export function dollarsToCents(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

/** Strip HTML to readable plain text (Shopify body_html is rich markup). */
export function htmlToText(html: unknown): string {
  const s = String(html ?? '');
  if (!s) return '';
  return s
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*>/gi, '\n') // block breaks → newlines
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ') // drop remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

/** Map one raw Shopify product (from /products.json) into a ProductSpec. Pure.
 *  Returns null if the product has no usable title/price. `origin` builds the
 *  product page URL. Exported for tests. */
export function mapShopifyProduct(raw: any, origin: string | null): ProductSpec | null {
  const title = String(raw?.title ?? '').trim();
  if (!title) return null;
  const handle = String(raw?.handle ?? '').trim();

  const rawVariants: any[] = Array.isArray(raw?.variants) ? raw.variants : [];
  const variants: ProductVariantSpec[] = [];
  for (const v of rawVariants) {
    const priceCents = dollarsToCents(v?.price);
    if (priceCents == null) continue;
    const options = [v?.option1, v?.option2, v?.option3]
      .map((o) => String(o ?? '').trim())
      .filter((o) => o && o.toLowerCase() !== 'default title');
    const vspec: ProductVariantSpec = {
      title: String(v?.title ?? '').trim() || 'Default',
      priceCents,
    };
    const compareAt = dollarsToCents(v?.compare_at_price);
    if (compareAt != null && compareAt > priceCents) vspec.compareAtCents = compareAt;
    const sku = String(v?.sku ?? '').trim();
    if (sku) vspec.sku = sku;
    if (typeof v?.available === 'boolean') vspec.available = v.available;
    const grams = Number(v?.grams);
    if (Number.isFinite(grams) && grams > 0) vspec.grams = Math.round(grams);
    if (options.length) vspec.options = options;
    variants.push(vspec);
  }
  if (!variants.length) return null; // no priced variant → not sellable

  // Representative price = lowest-priced variant (matches "from $X" storefront norms).
  const cheapest = variants.reduce((a, b) => (b.priceCents < a.priceCents ? b : a));

  const images: string[] = [];
  const seen = new Set<string>();
  for (const im of Array.isArray(raw?.images) ? raw.images : []) {
    const src = String(im?.src ?? '').trim();
    if (src && /^https?:\/\//i.test(src) && !seen.has(src)) {
      seen.add(src);
      images.push(src);
      if (images.length >= MAX_IMAGES_PER_PRODUCT) break;
    }
  }

  const options = (Array.isArray(raw?.options) ? raw.options : [])
    .map((o: any) => ({
      name: String(o?.name ?? '').trim(),
      values: (Array.isArray(o?.values) ? o.values : []).map((x: any) => String(x ?? '').trim()).filter(Boolean),
    }))
    .filter((o: { name: string; values: string[] }) =>
      o.name && o.values.length && o.name.toLowerCase() !== 'title');

  return {
    title: title.slice(0, 200),
    handle,
    description: htmlToText(raw?.body_html).slice(0, 4000),
    productType: String(raw?.product_type ?? '').trim() || undefined,
    vendor: String(raw?.vendor ?? '').trim() || undefined,
    priceCents: cheapest.priceCents,
    compareAtCents: cheapest.compareAtCents,
    currency: 'USD',
    images,
    variants,
    options,
    requiresShipping: rawVariants.some((v) => v?.requires_shipping !== false),
    ...(cheapest.grams ? { grams: cheapest.grams } : {}),
    productUrl: origin && handle ? `${origin}/products/${handle}` : null,
  };
}

/** Parse a raw /products.json body into ProductSpec[]. Pure; exported for tests. */
export function parseShopifyProducts(json: any, origin: string | null): ProductSpec[] {
  const raw = Array.isArray(json?.products) ? json.products : [];
  const out: ProductSpec[] = [];
  for (const p of raw.slice(0, MAX_PRODUCTS)) {
    const spec = mapShopifyProduct(p, origin);
    if (spec) out.push(spec);
  }
  return out;
}

/**
 * Fetch + parse a store's public Shopify catalog. Returns [] for non-Shopify sites
 * or any failure (best-effort — never throws). `fetchImpl` is injectable for tests.
 */
export async function importShopifyProducts(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProductSpec[]> {
  let origin: string;
  try {
    origin = assertPublicHttpUrl(rawUrl).origin;
  } catch {
    return [];
  }

  const endpoint = `${origin}/products.json?limit=250`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Re-guard the derived endpoint (origin came from a validated URL, but be safe).
    assertPublicHttpUrl(endpoint);
    const res = await fetchImpl(endpoint, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'application/json' },
    });
    if (!res.ok) return [];
    const ctype = res.headers.get('content-type') || '';
    if (ctype && !/application\/json|text\/json/i.test(ctype)) return [];
    const text = await readCappedText(res, PRODUCTS_JSON_CAP);
    const json = JSON.parse(text);
    return parseShopifyProducts(json, origin);
  } catch (e) {
    if (e instanceof ScrapeError) return [];
    return []; // network/JSON/timeout → treat as "not a Shopify store"
  } finally {
    clearTimeout(timer);
  }
}

/** Read a response body but bail past a byte cap (mirrors scrapeSite#readCapped). */
async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > maxBytes * 2) throw new Error('too_large');
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
        throw new Error('too_large');
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}
