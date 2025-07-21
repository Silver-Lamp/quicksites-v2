// app/api/webhook/og-rebuild/route.tsx
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { cacheOgImage } from '../../../../lib/og/cacheOgImage';
import React from 'react';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { slug, page } = await req.json();
  if (!slug || !page) return new Response('Missing slug/page', { status: 400 });

  const { data: site } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  const pageData = site?.data?.pages.find((p: any) => p.slug === page);
  const title = pageData?.meta?.title || pageData?.title || site?.template_name;
  const heroImg = pageData?.content_blocks?.find((b: any) => b.type === 'hero')?.content?.image_url;
  const logo = site?.logo_url || 'https://quicksites.ai/default-og.png';
  const isLight = site?.theme === 'light';

  const image = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: isLight ? '#fff' : '#000',
          color: isLight ? '#111' : '#fff',
          padding: '40px',
          fontSize: 48,
        }}
      >
        {heroImg && (
          <img
            src={heroImg}
            alt="Hero"
            width={1200}
            height={630}
            style={{ objectFit: 'cover', position: 'absolute', zIndex: -1, opacity: 0.2 }}
          />
        )}
        <img src={logo} alt="Logo" width={96} height={96} style={{ marginBottom: 24 }} />
        <strong>{title}</strong>
      </div>
    ),
    { width: 1200, height: 630 }
  );

  const buffer = await (image as any).arrayBuffer();
  const publicUrl = await cacheOgImage(slug, page, Buffer.from(buffer));
  return Response.json({ success: true, url: publicUrl });
}
