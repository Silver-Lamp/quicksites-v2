// app/api/public/showcase/route.ts
//
// Public, read-only feed for the homepage "Built with QuickSites" showcase.
// Shows all *publishable* published sites (those with a business name, industry,
// or hero image), priority-ordered by lib/home/featured-sites.ts. Each site
// carries a `hidden` flag (admin-hidden); the client filters hidden out for
// visitors and lets admins toggle them. Also returns the admin-chosen display mode.

import { NextResponse } from 'next/server';
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
} from '@/lib/home/showcase-helpers';
import { getSiteSetting } from '@/lib/settings/siteSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
      .select('slug, business_name, industry_label, industry, hero_url, logo_url, data, domain, custom_domain')
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .eq('is_version', false);
    if (error) return NextResponse.json({ sites: [], displayMode });

    const priority = new Map(FEATURED_SITE_SLUGS.map((s, i) => [s, i]));

    const sites = (data || [])
      .map((r: any) => {
        const heroUrl = firstNonEmpty(r.hero_url) || extractHeroImage(r.data);
        const industryRaw = firstNonEmpty(r.industry_label, r.industry);
        // 'generic' is the seed placeholder industry — treat as no real identity.
        const industry = industryRaw && industryRaw.toLowerCase() !== 'generic' ? industryRaw : null;
        const name = firstNonEmpty(r.business_name) || (industry ? prettifySlug(r.slug) : null);
        // Prefer the site's live custom domain for "View live"; else the platform path.
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
          // Real identity = a business name, an industry, a live custom domain, or
          // an explicit feature. A stock hero alone doesn't qualify (blank demos
          // all have seed images), so this keeps the generic demos out by default.
          _publishable: Boolean(firstNonEmpty(r.business_name) || industry || dom || isFeatured),
        };
      })
      .filter((s: any) => s._publishable)
      .sort((a: any, b: any) => {
        // 1) explicit admin order wins
        const oa = orderIdx.has(a.slug) ? (orderIdx.get(a.slug) as number) : null;
        const ob = orderIdx.has(b.slug) ? (orderIdx.get(b.slug) as number) : null;
        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        // 2) then the curated priority list, 3) then name
        const pa = priority.has(a.slug) ? (priority.get(a.slug) as number) : Number.MAX_SAFE_INTEGER;
        const pb = priority.has(b.slug) ? (priority.get(b.slug) as number) : Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      })
      .map(({ _publishable, ...s }: any) => s);

    return NextResponse.json({ sites, displayMode });
  } catch {
    return NextResponse.json({ sites: [], displayMode });
  }
}
