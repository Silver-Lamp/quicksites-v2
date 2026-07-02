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

export async function getShowcaseData(): Promise<ShowcaseData> {
  const rawMode = await getSiteSetting<string>(SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE);
  const displayMode = isShowcaseMode(rawMode) ? rawMode : DEFAULT_SHOWCASE_MODE;
  const hiddenList = await getSiteSetting<string[]>(SHOWCASE_HIDDEN_KEY, []);
  const hidden = new Set(Array.isArray(hiddenList) ? hiddenList : []);
  const orderList = await getSiteSetting<string[]>(SHOWCASE_ORDER_KEY, []);
  const orderIdx = new Map((Array.isArray(orderList) ? orderList : []).map((s, i) => [s, i]));

  try {
    const supa = await getServerSupabase({ serviceRole: true });
    const { data, error } = await (supa as any)
      .from('templates')
      .select('slug, business_name, industry_label, industry, hero_url, logo_url, data, domain, custom_domain, owner_id, claim_source')
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .eq('is_version', false);
    if (error) return { sites: [], displayMode };

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

    return { sites, displayMode };
  } catch {
    return { sites: [], displayMode };
  }
}
