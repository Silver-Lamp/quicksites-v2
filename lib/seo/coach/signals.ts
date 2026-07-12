// lib/seo/coach/signals.ts
//
// Gather a site's SEO signals: owner-lens on-page analysis (from templates.data) plus a
// Search Console rollup for its domain IF connected. GSC is read CACHE-FIRST from the
// `sum:` gsc_cache rows warmed by app/api/gsc/summary — a fan-out over many sites must
// not live-hit the GSC API. See docs/AI_SEO_COACHING.md.

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import { analyzeSiteOnPage } from '@/lib/seo/coach/onPage';
import type { SiteSeoSignals, GscSiteSummary } from '@/lib/seo/coach/types';

type AnyClient = SupabaseClient<any, any, any>;

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'quicksites.ai';
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export type CoachSiteRow = {
  id: string;
  owner_id: string;
  slug: string | null;
  data: any;
  custom_domain?: string | null;
  domain?: string | null;
};

/** The site's public domain (custom domain preferred, else the platform subdomain). */
export function resolveSiteDomain(t: { custom_domain?: string | null; domain?: string | null; slug: string | null }): string | null {
  const custom = (t.custom_domain || t.domain || '').trim();
  if (custom) return custom;
  return t.slug ? `${t.slug}.${BASE_DOMAIN}` : null;
}

/** Normalized GSC-matching keys for a site (custom domain + platform subdomain). */
export function siteGscKeys(t: { custom_domain?: string | null; domain?: string | null; slug: string | null }): string[] {
  const keys = new Set<string>();
  const custom = (t.custom_domain || t.domain || '').trim();
  if (custom) keys.add(normalizeGscDomain(custom));
  if (t.slug) keys.add(normalizeGscDomain(`${t.slug}.${BASE_DOMAIN}`));
  return Array.from(keys).filter(Boolean);
}

/**
 * Cache-first 28-day GSC summary for a site owned by `ownerId`. Returns null when the
 * site's domain isn't a connected property, or when no fresh cache row exists (we do NOT
 * live-fetch here — the summary route warms the cache on the owner's own dashboard visits).
 */
export async function fetchSiteGscSummary(
  admin: AnyClient,
  ownerId: string,
  keys: string[],
): Promise<GscSiteSummary | null> {
  if (!keys.length) return null;

  // Which of this owner's connected properties matches one of the site's keys?
  const { data: tokenRows } = await (admin as any)
    .from('gsc_tokens')
    .select('domain')
    .eq('user_id', ownerId);
  const match = ((tokenRows as any[]) ?? []).find((r) => keys.includes(normalizeGscDomain(r?.domain)));
  if (!match?.domain) return null;

  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);

  const { data: cached } = await (admin as any)
    .from('gsc_cache')
    .select('data, expires_at')
    .eq('domain', `sum:${match.domain}`)
    .eq('start_date', ymd(start))
    .eq('end_date', ymd(end))
    .maybeSingle();

  const d = cached?.data as { clicks?: number; impressions?: number; position?: number } | undefined;
  if (!d || typeof d.impressions !== 'number') return null;

  const clicks = d.clicks ?? 0;
  const impressions = d.impressions ?? 0;
  return {
    clicks,
    impressions,
    position: typeof d.position === 'number' ? d.position : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
  };
}

/** True when the site has no custom domain and is served on a platform subdomain. */
export function isPlatformSubdomain(t: { custom_domain?: string | null; domain?: string | null; slug: string | null }): boolean {
  const custom = (t.custom_domain || t.domain || '').trim();
  return !custom && !!t.slug;
}

/** Full signal bundle for one site. */
export async function gatherSiteSeoSignals(admin: AnyClient, site: CoachSiteRow): Promise<SiteSeoSignals> {
  const onPage = analyzeSiteOnPage(site.data ?? {});
  const keys = siteGscKeys(site);
  const gsc = await fetchSiteGscSummary(admin, site.owner_id, keys);
  return {
    domain: resolveSiteDomain(site),
    isPlatformSubdomain: isPlatformSubdomain(site),
    gscConnected: gsc != null,
    onPage,
    gsc,
  };
}
