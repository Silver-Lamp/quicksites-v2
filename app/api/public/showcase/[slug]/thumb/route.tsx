// app/api/public/showcase/[slug]/thumb/route.tsx
//
// Generated site thumbnail (16:10) for the admin list + showcase. Renders the
// site's real hero, else a themed accent card (see lib/og/siteOgCard). Works for
// the owner's drafts too (not gated to published/is_site).

import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { extractHeroImage, firstNonEmpty, prettifySlug } from '@/lib/home/showcase-helpers';
import { SiteOgCard } from '@/lib/og/siteOgCard';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 750;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } }
);

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let name = prettifySlug(slug);
  let industry: string | null = null;
  let hero: string | null = null;
  let accentToken: string | undefined;
  let darkMode = true;

  try {
    const FIELDS = 'template_name, business_name, industry_label, industry, hero_url, color_mode, data';
    // Prefer the canonical (non-version) row, but many live templates are flagged
    // is_version=true / null; fall back to the most-recent row for this slug so their
    // real hero image still resolves instead of dropping to the monogram card.
    let { data } = await admin
      .from('templates')
      .select(FIELDS)
      .eq('slug', slug)
      .eq('is_version', false)
      .maybeSingle();
    if (!data) {
      const fb = await admin
        .from('templates')
        .select(FIELDS)
        .eq('slug', slug)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = fb.data;
    }
    if (data) {
      const d: any = data;
      name = firstNonEmpty(d.business_name, d.template_name) || prettifySlug(slug);
      industry = d.industry_label || d.industry || null;
      hero = firstNonEmpty(d.hero_url) || extractHeroImage(d.data);
      const theme = d?.data?.meta?.theme;
      accentToken = theme?.accentColor;
      darkMode = String(theme?.darkMode ?? d.color_mode ?? 'dark').toLowerCase() !== 'light';
    }
  } catch {
    /* fall through to themed card */
  }

  return new ImageResponse(
    <SiteOgCard name={name} industry={industry} hero={hero} accentToken={accentToken} darkMode={darkMode} />,
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' },
    }
  );
}
