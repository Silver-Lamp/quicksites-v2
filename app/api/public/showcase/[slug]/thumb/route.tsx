// app/api/public/showcase/[slug]/thumb/route.tsx
//
// Generated showcase thumbnail: composites the site's real hero image with its
// business name, industry, and a "Built with QuickSites" badge into a uniform
// 16:10 card. Falls back to a branded lettered card when no hero exists.

import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { extractHeroImage, firstNonEmpty, prettifySlug } from '@/lib/home/showcase-helpers';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 750;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let name = prettifySlug(slug);
  let industry: string | null = null;
  let hero: string | null = null;

  try {
    const { data } = await admin
      .from('templates')
      .select('template_name, business_name, industry_label, industry, hero_url, data')
      .eq('slug', slug)
      .eq('is_site', true)
      .eq('is_version', false)
      .maybeSingle();
    if (data) {
      name = firstNonEmpty((data as any).business_name, (data as any).template_name) || prettifySlug(slug);
      industry = (data as any).industry_label || (data as any).industry || null;
      hero = firstNonEmpty((data as any).hero_url) || extractHeroImage((data as any).data);
    }
  } catch {
    /* fall through to lettered card */
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: '#09090b' }}>
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
              fontSize: 320,
              fontWeight: 800,
              color: '#27272a',
              backgroundImage: 'linear-gradient(135deg, #18181b, #09090b)',
            }}
          >
            {name.charAt(0).toUpperCase()}
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
            backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.88) 100%)',
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
          <div style={{ display: 'flex', color: '#ffffff', fontSize: 66, fontWeight: 800 }}>{name}</div>
          {industry ? (
            <div style={{ display: 'flex', color: '#a1a1aa', fontSize: 34, marginTop: 8 }}>{industry}</div>
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
