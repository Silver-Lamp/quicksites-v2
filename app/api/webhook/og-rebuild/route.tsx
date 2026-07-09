// app/api/webhook/og-rebuild/route.tsx
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { cacheOgImage } from '../../../../lib/og/cacheOgImage';
import { extractHeroImage, firstNonEmpty, prettifySlug } from '@/lib/home/showcase-helpers';
import { SiteOgCard } from '@/lib/og/siteOgCard';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export async function POST(req: Request) {
  const { slug, page } = await req.json();
  if (!slug || !page) return new Response('Missing slug/page', { status: 400 });

  const { data: site } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  const s: any = site ?? {};
  const pageData = s?.data?.pages?.find((p: any) => p.slug === page);
  const name = firstNonEmpty(s.business_name, pageData?.meta?.title, pageData?.title, s.template_name) || prettifySlug(slug);
  const industry = s.industry_label || s.industry || null;
  const heroBlock = pageData?.content_blocks?.find((b: any) => b.type === 'hero')?.content?.image_url;
  const hero = firstNonEmpty(heroBlock, s.hero_url) || extractHeroImage(s.data);
  const theme = s?.data?.meta?.theme;
  const accentToken = theme?.accentColor;
  const darkMode = String(theme?.darkMode ?? s.color_mode ?? 'dark').toLowerCase() !== 'light';

  const image = new ImageResponse(
    <SiteOgCard name={name} industry={industry} hero={hero} accentToken={accentToken} darkMode={darkMode} nameSize={72} monogramSize={300} />,
    { width: 1200, height: 630 }
  );

  const buffer = await (image as any).arrayBuffer();
  const publicUrl = await cacheOgImage(slug, page, Buffer.from(buffer));
  return Response.json({ success: true, url: publicUrl });
}
