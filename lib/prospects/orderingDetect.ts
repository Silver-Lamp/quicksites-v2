// lib/prospects/orderingDetect.ts
//
// Does this restaurant take online orders, and through whom? Decided from the LINKS on its own
// website — never from prose. "Powered by Shopify" in a form label made hicustom.com read as a
// store once (lib/rebuild/storefrontDetect.ts); the same trap here is a blog post that mentions
// DoorDash. Only an href/src/action pointing at a known ordering host counts, and the matched
// hosts are returned as evidence so a reader can see why.
//
// Two segments fall out of this that the sweep could not see before:
//   none              — a site, but no ordering link found. The no-monthly fee has nothing to beat.
//   third-party only  — DoorDash / Grubhub / UberEats and nothing first-party. They pay a
//                       per-order commission a single-digit take undercuts at any volume.
// A first-party platform (Toast, Square, …) is a business already served; leave it alone.
//
// Pure: detectOrderingPlatform(html) → { platform, evidence }. The fetch lives beside it and
// reads the homepage plus up to two same-origin "order"/"menu" links, because a link kept on a
// subpage was the known blind spot of the first (homepage-only) read.

import { assertPublicHttpUrl, readCapped } from '@/lib/rebuild/scrapeSite';

export type OrderingPlatform =
  | 'toast'
  | 'square'
  | 'clover'
  | 'bentobox'
  | 'wix_restaurants'
  | 'chownow'
  | 'popmenu'
  | 'slice'
  | 'owner'
  | 'menufy'
  | 'olo'
  | 'shopify'
  | 'doordash'
  | 'grubhub'
  | 'ubereats'
  | 'none';

export const THIRD_PARTY: ReadonlySet<OrderingPlatform> = new Set(['doordash', 'grubhub', 'ubereats']);

/** Host patterns, matched against the HOST of a URL found in an attribute — never against prose. */
const HOST_SIGNATURES: Array<[OrderingPlatform, RegExp]> = [
  ['toast', /(^|\.)toasttab\.com$|(^|\.)toast\.app$/i],
  ['square', /(^|\.)squareup\.com$|(^|\.)square\.site$/i],
  ['clover', /(^|\.)clover\.com$|(^|\.)cloveronline\.com$/i],
  ['bentobox', /(^|\.)getbento\.com$|(^|\.)bentobox\.com$/i],
  ['wix_restaurants', /(^|\.)wixrestaurants\.com$/i],
  ['chownow', /(^|\.)chownow\.com$/i],
  ['popmenu', /(^|\.)popmenu\.com$/i],
  ['slice', /(^|\.)slicelife\.com$/i],
  ['owner', /(^|\.)owner\.com$/i],
  ['menufy', /(^|\.)menufy\.com$/i],
  ['olo', /(^|\.)olo\.com$|(^|\.)olo\.io$/i],
  ['shopify', /(^|\.)myshopify\.com$/i],
  ['doordash', /(^|\.)doordash\.com$/i],
  ['grubhub', /(^|\.)grubhub\.com$/i],
  ['ubereats', /(^|\.)ubereats\.com$/i],
];

/** First-party ranks above third-party when both are present: the business has its own channel. */
const PRIORITY: OrderingPlatform[] = ['toast', 'square', 'clover', 'bentobox', 'wix_restaurants', 'chownow', 'popmenu', 'slice', 'owner', 'menufy', 'olo', 'shopify', 'doordash', 'grubhub', 'ubereats'];

export type OrderingDetection = {
  platform: OrderingPlatform;
  /** Every platform whose host was linked, first-party first. */
  all: OrderingPlatform[];
  /** The matched hosts, de-duplicated — why, never prose. */
  evidence: string[];
};

/** Every URL in an href / src / action / data-* attribute. Prose is deliberately not read. */
function attributeUrls(html: string): string[] {
  const out: string[] = [];
  const re = /\b(?:href|src|action|data-[a-z-]+)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function hostOf(raw: string): string | null {
  const s = raw.trim();
  if (!/^https?:\/\//i.test(s) && !s.startsWith('//')) return null;
  try {
    return new URL(s.startsWith('//') ? `https:${s}` : s).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function detectOrderingPlatform(html: string): OrderingDetection {
  const found = new Map<OrderingPlatform, Set<string>>();
  for (const u of attributeUrls(html)) {
    const host = hostOf(u);
    if (!host) continue;
    for (const [platform, re] of HOST_SIGNATURES) {
      if (re.test(host)) {
        if (!found.has(platform)) found.set(platform, new Set());
        found.get(platform)!.add(host);
      }
    }
  }
  const all = PRIORITY.filter((p) => found.has(p));
  const evidence = Array.from(new Set(all.flatMap((p) => Array.from(found.get(p)!))));
  return { platform: all[0] ?? 'none', all, evidence };
}

/** Same-origin links whose href or text says "order" or "menu" — where a subpage link would hide. */
export function orderingSubpageLinks(html: string, pageUrl: string, max = 2): string[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const baseHost = base.hostname.replace(/^www\./, '');
  const out: string[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < max) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (!/order|menu/i.test(`${href} ${text}`)) continue;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(abs.protocol)) continue;
    if (abs.hostname.replace(/^www\./, '') !== baseHost) continue;
    if (abs.href === base.href) continue;
    if (!out.includes(abs.href)) out.push(abs.href);
  }
  return out;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 QuickSitesOrderingCheck/1.0';
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 1_500_000;

async function fetchHtml(url: string, fetchImpl: typeof fetch): Promise<{ html: string; finalUrl: string } | null> {
  assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.5' }, redirect: 'follow', signal: controller.signal });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct && !/html|xml/i.test(ct)) return null;
    // A redirect may land on a private host; check the final URL too.
    assertPublicHttpUrl(res.url || url);
    const html = await readCapped(res, MAX_BYTES);
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type OrderingReadResult =
  | { ok: true; detection: OrderingDetection; pagesRead: number }
  | { ok: false; reason: 'unreachable' | 'bad_url' };

/**
 * Read a business's site and decide its ordering platform: the homepage, then up to two
 * same-origin order/menu links when the homepage linked nothing. An unreachable site is
 * reported as unreachable, never as 'none' — a failed read is not a finding.
 */
export async function readOrderingPlatform(website: string, fetchImpl: typeof fetch = fetch): Promise<OrderingReadResult> {
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    assertPublicHttpUrl(url);
  } catch {
    return { ok: false, reason: 'bad_url' };
  }
  const home = await fetchHtml(url, fetchImpl);
  if (!home) return { ok: false, reason: 'unreachable' };
  let detection = detectOrderingPlatform(home.html);
  let pagesRead = 1;
  if (detection.platform === 'none') {
    for (const sub of orderingSubpageLinks(home.html, home.finalUrl)) {
      const page = await fetchHtml(sub, fetchImpl);
      if (!page) continue;
      pagesRead += 1;
      const d = detectOrderingPlatform(page.html);
      if (d.platform !== 'none') {
        detection = d;
        break;
      }
    }
  }
  return { ok: true, detection, pagesRead };
}
