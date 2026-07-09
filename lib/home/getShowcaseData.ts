// lib/home/getShowcaseData.ts
//
// Server-side data for the homepage showcase. Used by both the public JSON feed
// (/api/public/showcase) and the homepage server component (for SSR, so the row
// renders in the initial HTML for everyone — including unauthenticated users —
// without depending on a client fetch).

import { getServerSupabase } from '@/lib/supabase/server';
import { FEATURED_SITE_SLUGS } from '@/lib/home/featured-sites';
import {
  prettifySlug,
  firstNonEmpty,
  extractHeroImage,
  isShowcaseMode,
  DEFAULT_SHOWCASE_MODE,
  SHOWCASE_MODE_KEY,
  SHOWCASE_HIDDEN_KEY,
  SHOWCASE_ORDER_KEY,
  type ShowcaseDisplayMode,
} from '@/lib/home/showcase-helpers';
import { getSiteSetting } from '@/lib/settings/siteSettings';

export type ShowcaseSite = {
  slug: string;
  name: string;
  industry: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
  href: string;
  hidden: boolean;
};

export type ShowcaseData = { sites: ShowcaseSite[]; displayMode: ShowcaseDisplayMode };

// Per-instance last-good cache. The templates query intermittently fails on SSR
// (transient DB/connection blip) and would otherwise blank the row. When a query
// succeeds we stash the site list here; when a later one fails or comes back empty
// we serve the last-good sites (with the current display mode) instead of nothing.
// Serverless memory is per-instance and short-lived, so this only ever serves
// genuinely recent data — it's a blip cushion, not a real cache.
const FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 min
let lastGood: { sites: ShowcaseSite[]; at: number } | null = null;

/** On a failed/empty fetch, serve recent last-good sites if we have them. */
function fallbackData(displayMode: ShowcaseDisplayMode, now: number): ShowcaseData {
  if (lastGood && now - lastGood.at < FALLBACK_TTL_MS) {
    return { sites: lastGood.sites, displayMode };
  }
  return { sites: [], displayMode };
}

export async function getShowcaseData(): Promise<ShowcaseData> {
  const now = Date.now();
  // Fetch the three showcase settings in parallel (was 3 sequential round-trips).
  const [rawMode, hiddenList, orderList] = await Promise.all([
    getSiteSetting<string>(SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE),
    getSiteSetting<string[]>(SHOWCASE_HIDDEN_KEY, []),
    getSiteSetting<string[]>(SHOWCASE_ORDER_KEY, []),
  ]);
  const displayMode = isShowcaseMode(rawMode) ? rawMode : DEFAULT_SHOWCASE_MODE;
  const hidden = new Set(Array.isArray(hiddenList) ? hiddenList : []);
  const orderIdx = new Map((Array.isArray(orderList) ? orderList : []).map((s, i) => [s, i]));

  try {
    const supa = await getServerSupabase({ serviceRole: true });
    // The showcase query intermittently failed on SSR (transient DB/connection
    // hiccup), which blanked the "Built with QuickSites" row. Retry once before
    // giving up so a single transient error doesn't drop the whole row.
    let data: any = null;
    let error: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await (supa as any)
        .from('templates')
        .select('slug, business_name, industry_label, industry, hero_url, logo_url, data, domain, custom_domain, owner_id, claim_source')
        .eq('is_site', true)
        .eq('published', true)
        .eq('archived', false)
        .eq('is_version', false);
      data = res.data;
      error = res.error;
      if (!error && data) break;
    }
    if (error) return fallbackData(displayMode, now);

    // Defense-in-depth: never surface a guest-built site still owned by an
    // anonymous (unclaimed) user. Anon users can't publish, so this should always
    // be empty — but it guarantees abuse/junk can't leak onto the homepage.
    let anonOwned = new Set<string>();
    const guestOwnerIds = Array.from(
      new Set((data || []).filter((r: any) => r.claim_source === 'guest_build' && r.owner_id).map((r: any) => r.owner_id)),
    );
    if (guestOwnerIds.length) {
      const { data: anon } = await (supa as any).rpc('anonymous_user_ids', { p_ids: guestOwnerIds });
      anonOwned = new Set((anon || []).map((row: any) => (typeof row === 'string' ? row : row.anonymous_user_ids ?? row.id)));
    }
    const rows = (data || []).filter((r: any) => !(r.owner_id && anonOwned.has(r.owner_id)));

    const priority = new Map(FEATURED_SITE_SLUGS.map((s, i) => [s, i]));

    const sites: ShowcaseSite[] = rows
      .map((r: any) => {
        const heroUrl = firstNonEmpty(r.hero_url) || extractHeroImage(r.data);
        const industryRaw = firstNonEmpty(r.industry_label, r.industry);
        const industry = industryRaw && industryRaw.toLowerCase() !== 'generic' ? industryRaw : null;
        const name = firstNonEmpty(r.business_name) || (industry ? prettifySlug(r.slug) : null);
        const dom = firstNonEmpty(r.custom_domain, r.domain);
        const href = dom ? `https://${dom.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : `/sites/${r.slug}`;
        const isFeatured = priority.has(r.slug);
        return {
          slug: r.slug as string,
          name: name || prettifySlug(r.slug),
          industry,
          heroUrl,
          logoUrl: firstNonEmpty(r.logo_url),
          href,
          hidden: hidden.has(r.slug),
          _publishable: Boolean(firstNonEmpty(r.business_name) || industry || dom || isFeatured),
        } as ShowcaseSite & { _publishable: boolean };
      })
      .filter((s: any) => s._publishable)
      .sort((a: any, b: any) => {
        const oa = orderIdx.has(a.slug) ? (orderIdx.get(a.slug) as number) : null;
        const ob = orderIdx.has(b.slug) ? (orderIdx.get(b.slug) as number) : null;
        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        const pa = priority.has(a.slug) ? (priority.get(a.slug) as number) : Number.MAX_SAFE_INTEGER;
        const pb = priority.has(b.slug) ? (priority.get(b.slug) as number) : Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      })
      .map(({ _publishable, ...s }: any) => s);

    // A successful, non-empty fetch becomes the new last-good snapshot. An empty
    // result (e.g. query returned nothing) falls back to the previous snapshot
    // rather than blanking the row.
    if (sites.length > 0) {
      lastGood = { sites, at: now };
      return { sites, displayMode };
    }
    return fallbackData(displayMode, now);
  } catch {
    return fallbackData(displayMode, now);
  }
}
