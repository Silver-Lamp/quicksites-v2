// lib/seo/indexNow.ts
//
// IndexNow: notify participating search engines (Bing, Yandex, Seznam, Naver; Google
// observes the protocol but doesn't consume it) that a URL changed, for near-immediate
// re-crawl. This REPLACES the old google.com/ping + bing.com/ping sitemap-ping endpoints,
// which both providers deprecated in 2023 (they were no-ops).
//
// Setup: set INDEXNOW_KEY to an 8–128 char hex string, and the key is served at
// /api/indexnow/<key>.txt (app/api/indexnow/[key]/route.ts) on every host the app answers
// — including custom domains and delivered.menu subdomains, since /api isn't host-rewritten
// by middleware. No key → every function here is an inert no-op, so it's safe to leave
// wired before the key is provisioned.

import { menuSiteUrl } from '@/lib/menu/deliveredMenu';

const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** The configured IndexNow key, or null when unset/too short (feature off). */
export function indexNowKey(): string | null {
  const k = (process.env.INDEXNOW_KEY || '').trim();
  return k.length >= 8 && k.length <= 128 ? k : null;
}

/** Path (host-relative) where the key file is served. */
export function indexNowKeyPath(key: string): string {
  return `/api/indexnow/${key}.txt`;
}

export type IndexNowResult = { host: string; ok: boolean; status: number };

/**
 * The public URL to submit for a freshly-published template — only for sites with a
 * domain we KNOW resolves publicly: a custom domain, or a delivered.menu listing site.
 * Returns null otherwise (e.g. platform-subdomain sites), so we never submit a URL that
 * might 404. Pure.
 */
export function publicIndexUrl(t: {
  slug?: string | null;
  custom_domain?: string | null;
  claim_source?: string | null;
}): string | null {
  if (t.custom_domain) return `https://${t.custom_domain}`;
  const isMenuDraft = t.claim_source === 'listing_import' || t.claim_source === 'listing_claimed';
  if (t.slug && isMenuDraft) {
    const url = menuSiteUrl(t.slug);
    if (/^https?:\/\//.test(url)) return url; // menuSiteUrl → relative /preview when the base domain is unset
  }
  return null;
}

/**
 * Submit changed URLs to IndexNow, grouped by host (the protocol requires every URL in a
 * request to share the request's host + a same-host keyLocation). Best-effort: never
 * throws; returns a per-host result. No-op (returns []) when the key is unset or no valid
 * URLs are given. `fetchImpl` is injectable for tests.
 */
export async function submitToIndexNow(
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult[]> {
  const key = indexNowKey();
  if (!key) return [];

  const byHost = new Map<string, string[]>();
  for (const raw of urls) {
    const u = (raw ?? '').trim();
    if (!u) continue;
    let host: string;
    try {
      host = new URL(u).host;
    } catch {
      continue; // skip anything that isn't an absolute URL
    }
    const list = byHost.get(host) ?? [];
    if (!list.includes(u)) list.push(u);
    byHost.set(host, list);
  }
  if (!byHost.size) return [];

  const results: IndexNowResult[] = [];
  for (const [host, urlList] of byHost) {
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `https://${host}${indexNowKeyPath(key)}`,
          urlList,
        }),
      });
      results.push({ host, ok: res.ok, status: res.status });
    } catch {
      results.push({ host, ok: false, status: 0 });
    }
  }
  return results;
}
