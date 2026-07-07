// lib/rebuild/importJsonLd.ts
//
// Non-Shopify e-commerce fallback for the rebuild pipeline. Most stores (WooCommerce,
// Squarespace, BigCommerce, custom carts) don't expose a /products.json, but nearly
// all emit schema.org `Product` JSON-LD (for Google Shopping / rich results) and/or
// OpenGraph `product:*` meta. We parse that structured data — already captured by
// scrapeSite — into the SAME ProductSpec shape the Shopify importer produces, so the
// downstream storefront assembly + catalog provisioning are identical.
//
// Pure (no I/O): operates on the parsed JSON-LD blocks + og meta from a ScrapedSite.

import { dollarsToCents, htmlToText, type ProductSpec } from '@/lib/rebuild/importShopify';
import type { ScrapedSite } from '@/lib/rebuild/scrapeSite';

const MAX_PRODUCTS = 60;

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'item';
}

/** Flatten JSON-LD into a flat node list: unwraps arrays, `@graph`, and ItemList. */
function collectNodes(data: any, out: any[] = [], depth = 0): any[] {
  if (!data || depth > 6) return out;
  if (Array.isArray(data)) {
    for (const d of data) collectNodes(d, out, depth + 1);
    return out;
  }
  if (typeof data === 'object') {
    out.push(data);
    if (Array.isArray(data['@graph'])) collectNodes(data['@graph'], out, depth + 1);
    if (Array.isArray(data.itemListElement)) {
      for (const el of data.itemListElement) collectNodes(el?.item ?? el, out, depth + 1);
    }
  }
  return out;
}

function typeMatches(node: any, t: string): boolean {
  const raw = node?.['@type'];
  const types = Array.isArray(raw) ? raw : [raw];
  return types.some((x) => String(x || '').toLowerCase() === t);
}

/** Product.image: string | string[] | ImageObject | ImageObject[] → absolute urls. */
function normalizeImages(img: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: any) => {
    const u = typeof v === 'string' ? v : v?.url ?? v?.contentUrl ?? null;
    if (typeof u === 'string' && /^https?:\/\//i.test(u) && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };
  if (Array.isArray(img)) img.forEach(push);
  else push(img);
  return out.slice(0, 10);
}

/** offers: Offer | Offer[] | AggregateOffer → the lowest price (cents) + currency. */
function priceFromOffers(offers: any): { priceCents?: number; currency?: string; url?: string } {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  let best: number | undefined;
  let currency: string | undefined;
  let url: string | undefined;
  for (const o of list) {
    // AggregateOffer uses lowPrice; a plain Offer uses price.
    const cand = o?.price ?? o?.lowPrice ?? o?.lowprice;
    const cents = dollarsToCents(cand);
    if (cents == null) continue;
    if (best == null || cents < best) {
      best = cents;
      currency = typeof o?.priceCurrency === 'string' ? o.priceCurrency : currency;
      url = typeof o?.url === 'string' ? o.url : url;
    }
  }
  return { priceCents: best, currency, url };
}

function cleanCurrency(c: string | undefined): string {
  const s = String(c || 'USD').toUpperCase().replace(/[^A-Z]/g, '');
  return /^[A-Z]{3}$/.test(s) ? s : 'USD';
}

function mapProductNode(node: any, pageUrl: string): ProductSpec | null {
  const title = String(node?.name ?? '').trim();
  if (!title) return null;
  const { priceCents, currency, url } = priceFromOffers(node?.offers);
  if (priceCents == null) return null; // no price → nothing we can sell
  const brand = typeof node?.brand === 'object' ? node?.brand?.name : node?.brand;
  return {
    title: title.slice(0, 200),
    handle: slugify(title),
    description: htmlToText(node?.description).slice(0, 4000),
    productType: String(node?.category ?? '').trim() || undefined,
    vendor: brand ? String(brand).trim().slice(0, 120) : undefined,
    priceCents,
    currency: cleanCurrency(currency),
    images: normalizeImages(node?.image),
    variants: [{ title: 'Default', priceCents }],
    options: [],
    requiresShipping: true,
    productUrl: url || (typeof node?.url === 'string' ? node.url : null) || pageUrl || null,
  };
}

/** Map schema.org Product JSON-LD nodes into ProductSpec[]. Pure; exported for tests. */
export function parseJsonLdProducts(structuredData: any[], pageUrl: string): ProductSpec[] {
  const nodes: any[] = [];
  for (const d of structuredData ?? []) collectNodes(d, nodes);
  const products: ProductSpec[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    if (!typeMatches(n, 'product')) continue;
    const p = mapProductNode(n, pageUrl);
    if (p && !seen.has(p.handle)) {
      seen.add(p.handle);
      products.push(p);
    }
    if (products.length >= MAX_PRODUCTS) break;
  }
  return products;
}

/** OpenGraph single-product fallback (product:price:amount + og:title/image). */
export function parseOgProduct(opts: {
  productMeta: { priceAmount?: string; priceCurrency?: string } | null;
  title: string | null;
  image: string | null;
  description: string | null;
  pageUrl: string;
}): ProductSpec[] {
  const amount = opts.productMeta?.priceAmount;
  if (!amount) return [];
  const priceCents = dollarsToCents(amount);
  if (priceCents == null) return [];
  const title = String(opts.title ?? '').trim();
  if (!title) return [];
  return [
    {
      title: title.slice(0, 200),
      handle: slugify(title),
      description: (opts.description || '').slice(0, 4000),
      priceCents,
      currency: cleanCurrency(opts.productMeta?.priceCurrency),
      images: opts.image ? [opts.image] : [],
      variants: [{ title: 'Default', priceCents }],
      options: [],
      requiresShipping: true,
      productUrl: opts.pageUrl || null,
    },
  ];
}

/**
 * Extract real products from a scraped (non-Shopify) page: schema.org Product JSON-LD
 * first, then an OpenGraph single-product fallback. Returns [] when the page has no
 * machine-readable product data (i.e. it's not a storefront we can replicate).
 */
export function productsFromScrape(scraped: ScrapedSite): ProductSpec[] {
  const fromLd = parseJsonLdProducts(scraped.structuredData ?? [], scraped.finalUrl);
  if (fromLd.length) return fromLd;
  return parseOgProduct({
    productMeta: scraped.productMeta,
    title: scraped.businessName || scraped.title,
    image: scraped.heroImage,
    description: scraped.description,
    pageUrl: scraped.finalUrl,
  });
}
