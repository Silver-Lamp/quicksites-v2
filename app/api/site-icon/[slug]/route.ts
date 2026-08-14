// app/api/site-icon/[slug]/route.ts
//
// The favicon for a tenant site: an industry mark (lib/brand/industryMarks.ts) tinted with that
// site's own theme accent.
//
// Before this, every published site served /favicon.ico — the QuickSites logo. A towing company's
// customers saw our brand in their tab, on a page that is supposed to be the towing company's.
// That is the same category of wrongness as the QuickSites wordmark appearing on a reseller's
// dashboard, just smaller and on more pages.
//
// SVG, not a generated raster: exact at 16px, free, recolourable, and incapable of containing an
// invented word (see the note in industryMarks.ts — two generated images shipped with misspelt
// lettering the same day this was written).
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { markSvg } from '@/lib/brand/industryMarks';
import { resolveSiteTheme } from '@/lib/theme/resolveSiteTheme';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Accent as a hex colour the SVG can use, or a neutral default. */
function accentFor(template: any): string {
  try {
    const resolved: any = resolveSiteTheme(template);
    const raw = resolved?.accentColor || (template?.data?.meta?.theme?.accentColor as string) || '';
    // Only ever emit something that is unmistakably a colour literal. This string is interpolated
    // into an inline style attribute, so anything else is an injection vector for a value that
    // arrives from template data.
    return /^#[0-9a-f]{3,8}$/i.test(String(raw)) ? String(raw) : '#0ea5e9';
  } catch {
    return '#0ea5e9';
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const { data: row } = await supabaseAdmin
    .from('templates')
    .select('industry, data')
    .eq('slug', slug)
    .maybeSingle();

  // No row is not an error here — a favicon request for an unknown slug should still return an
  // icon rather than a 404, or the browser shows its broken-page glyph in the tab.
  const industry = (row as any)?.industry ?? (row as any)?.data?.meta?.industry ?? null;
  const svg = markSvg(industry, accentFor(row), 64);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // Long cache: the mark only changes if the site changes industry or accent, and a stale
      // favicon for an hour is nobody's problem.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
