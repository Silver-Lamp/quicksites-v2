// app/api/public/showcase/route.ts
//
// Public, read-only feed of the hand-picked published sites shown on the
// homepage ("Built with QuickSites"). Returns only safe display fields for the
// curated allowlist (lib/home/featured-sites.ts), in allowlist order.

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { FEATURED_SITE_SLUGS } from '@/lib/home/featured-sites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fallback display name from a slug, e.g. "graftontowing" → "Graftontowing". */
function prettifySlug(slug: string): string {
  const s = slug.replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : slug;
}

/**
 * Pull a hero image from a site's `data` JSON (the real hero lives in the
 * content blocks, not the top-level hero_url column). Scans for image URLs and
 * prefers one under a `/hero/` path. Returns null if none found.
 */
function extractHeroImage(data: unknown): string | null {
  if (!data) return null;
  let text: string;
  try {
    text = typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return null;
  }
  const urls = text.match(/https?:\/\/[^"'\\\s]+\.(?:png|jpe?g|webp)/gi);
  if (!urls?.length) return null;
  return urls.find((u) => /\/hero\//i.test(u)) || urls[0];
}

/** First non-empty string, treating '' as absent. */
function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) if (v && v.trim()) return v;
  return null;
}

export async function GET() {
  if (!FEATURED_SITE_SLUGS.length) return NextResponse.json({ sites: [] });

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
    if (error) return NextResponse.json({ sites: [] });

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

    return NextResponse.json({ sites });
  } catch {
    return NextResponse.json({ sites: [] });
  }
}
