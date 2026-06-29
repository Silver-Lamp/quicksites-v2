// app/api/public/showcase/route.ts
//
// Public, read-only feed of the hand-picked published sites shown on the
// homepage ("Built with QuickSites"). Returns safe display fields for the
// curated allowlist (lib/home/featured-sites.ts), in allowlist order, plus the
// admin-chosen display mode.

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
} from '@/lib/home/showcase-helpers';
import { getSiteSetting } from '@/lib/settings/siteSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rawMode = await getSiteSetting<string>(SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE);
  const displayMode = isShowcaseMode(rawMode) ? rawMode : DEFAULT_SHOWCASE_MODE;

  if (!FEATURED_SITE_SLUGS.length) return NextResponse.json({ sites: [], displayMode });

  try {
    const supa = await getServerSupabase({ serviceRole: true });
    const { data, error } = await (supa as any)
      .from('templates')
      .select('slug, business_name, industry_label, industry, hero_url, logo_url, data')
      .in('slug', FEATURED_SITE_SLUGS)
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .eq('is_version', false);
    if (error) return NextResponse.json({ sites: [], displayMode });

    const bySlug = new Map<string, any>((data || []).map((r: any) => [r.slug, r]));
    const sites = FEATURED_SITE_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter(Boolean)
      .map((r: any) => ({
        slug: r.slug,
        name: r.business_name || prettifySlug(r.slug),
        industry: r.industry_label || r.industry || null,
        heroUrl: firstNonEmpty(r.hero_url) || extractHeroImage(r.data),
        logoUrl: firstNonEmpty(r.logo_url),
        href: `/sites/${r.slug}`,
      }));

    return NextResponse.json({ sites, displayMode });
  } catch {
    return NextResponse.json({ sites: [], displayMode });
  }
}
