// app/api/public/showcase/[slug]/thumb/route.tsx
//
// Generated site thumbnail / OG image: composites the site's real hero image with
// its business name, industry, and a "Built with QuickSites" badge into a uniform
// 16:10 card. When there's no hero, it falls back to a THEMED card that uses the
// site's curated accent (data.meta.theme) — a branded monogram + accent glow —
// instead of a flat gray letter, so the card previews the site's actual look.
// Works for the owner's drafts too (not gated to published/is_site).

import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { extractHeroImage, firstNonEmpty, prettifySlug } from '@/lib/home/showcase-helpers';
import { ACCENT_HSL } from '@/lib/theme/accentHsl';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 750;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } }
);

/** Tailwind accent token → an `hsla(...)` CSS string satori understands. */
function accentHsla(token: string | undefined, alpha: number): string {
  const triple = (token && ACCENT_HSL[token]) || ACCENT_HSL['sky-500'] || '199 89% 48%';
  const [h, s, l] = triple.split(/\s+/);
  return `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let name = prettifySlug(slug);
  let industry: string | null = null;
  let hero: string | null = null;
  let accentToken: string | undefined;
  let darkMode = true;

  try {
    const { data } = await admin
      .from('templates')
      .select('template_name, business_name, industry_label, industry, hero_url, color_mode, data')
      .eq('slug', slug)
      .eq('is_version', false)
      .maybeSingle();
    if (data) {
      const d: any = data;
      name = firstNonEmpty(d.business_name, d.template_name) || prettifySlug(slug);
      industry = d.industry_label || d.industry || null;
      hero = firstNonEmpty(d.hero_url) || extractHeroImage(d.data);
      const theme = d?.data?.meta?.theme;
      accentToken = theme?.accentColor;
      const mode = theme?.darkMode ?? d.color_mode ?? 'dark';
      darkMode = String(mode).toLowerCase() !== 'light';
    }
  } catch {
    /* fall through to themed card */
  }

  const base = darkMode ? '#0a0a0f' : '#f4f4f5';
  const letterColor = accentHsla(accentToken, 0.32);
  const nameColor = darkMode ? '#ffffff' : '#18181b';
  const subColor = darkMode ? '#a1a1aa' : '#52525b';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: base }}>
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            width={WIDTH}
            height={HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Accent-tinted glow over the themed base + a large branded monogram.
              backgroundImage: `radial-gradient(circle at 32% 30%, ${accentHsla(accentToken, 0.38)}, transparent 62%)`,
            }}
          >
            <div style={{ display: 'flex', fontSize: 340, fontWeight: 800, color: letterColor }}>
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* readability gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 35%, ${darkMode ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.45)'} 100%)`,
          }}
        />

        {/* accent bar (bottom edge) — a subtle brand cue */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: 8,
            display: 'flex',
            backgroundColor: accentHsla(accentToken, 1),
          }}
        />

        {/* badge */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 9999,
            backgroundColor: 'rgba(9,9,11,0.72)',
            color: '#7dd3fc',
            padding: '10px 22px',
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          Built with QuickSites
        </div>

        {/* identity */}
        <div style={{ position: 'absolute', left: 56, bottom: 48, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: hero ? '#ffffff' : nameColor, fontSize: 66, fontWeight: 800 }}>{name}</div>
          {industry ? (
            <div style={{ display: 'flex', color: hero ? '#a1a1aa' : subColor, fontSize: 34, marginTop: 8 }}>{industry}</div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' },
    }
  );
}
