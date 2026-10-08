// lib/seo/merchantListingGaps.ts
//
// Does this page's structured data STILL carry a merchant listing with no image?
//
// Google's rich-result verdict is from its LAST crawl, like its coverage state. After the
// emitter is fixed, the URL Inspection API keeps reporting "Missing field image" until Google
// recrawls — which can be months on a page it visits rarely (the starter's last crawl was ten
// weeks before the email). The sweep therefore fetches the page itself and asks this pure
// question; an empty answer means "fixed, awaiting recrawl", not "fixable".
//
// A merchant listing here = any JSON-LD object (anywhere in the graph) that carries `offers`.
// That is the trigger Google uses: a Product/Vehicle/Car with an offer is validated as a
// listing and `image` becomes required. Objects without `offers` are plain entities and never
// produce this error, which is exactly what lib/seo/vehicleJsonLd.ts relies on.

export type MerchantListingGap = { name: string; type: string };

const SCRIPT_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

/** Every JSON-LD document on the page, parsed; unparseable ones are skipped, never guessed at. */
export function jsonLdDocuments(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    const body = decodeEntities(m[1] ?? '').trim();
    if (!body) continue;
    try { out.push(JSON.parse(body)); } catch { /* not ours to repair */ }
  }
  return out;
}

function hasImage(o: Record<string, unknown>): boolean {
  const img = o.image;
  if (typeof img === 'string') return /^https?:\/\/\S+$/i.test(img.trim());
  if (Array.isArray(img)) return img.some((x) => typeof x === 'string' && /^https?:\/\/\S+$/i.test(x.trim()));
  if (img && typeof img === 'object') return typeof (img as { url?: unknown }).url === 'string';
  return false;
}

function walk(node: unknown, found: MerchantListingGap[]): void {
  if (Array.isArray(node)) { for (const n of node) walk(n, found); return; }
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if ('offers' in o && o.offers && !hasImage(o)) {
    found.push({ name: typeof o.name === 'string' ? o.name : '(unnamed)', type: typeof o['@type'] === 'string' ? (o['@type'] as string) : 'unknown' });
  }
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, found);
}

/** Objects on the page that Google would validate as a merchant listing and fail for no image. */
export function merchantListingGaps(html: string): MerchantListingGap[] {
  const found: MerchantListingGap[] = [];
  for (const doc of jsonLdDocuments(html)) walk(doc, found);
  return found;
}
