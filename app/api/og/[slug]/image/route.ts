// app/api/og/[slug]/image/route.ts
import { ImageResponse } from '@vercel/og';
import { renderOgImage } from '@/lib/og/renderOgImage';
import { createClient } from '@supabase/supabase-js';
// import { Resvg } from '@resvg/resvg-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const bucket = 'og-cache';
  const path = `snapshots/${slug}.png`;

  // ✅ Try serving cached image (data is a Blob)
  const { data: cached } = await supabase.storage.from(bucket).download(path);
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // 🧠 Fetch site branding
  const { data: site } = await supabase
    .from('published_sites')
    .select('*, branding_profiles(name, theme, brand, logo_url)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  const title = site?.branding_profiles?.name || slug;
  const theme = site?.branding_profiles?.theme || 'dark';
  const brand = site?.branding_profiles?.brand || 'green';
  const logoUrl = site?.branding_profiles?.logo_url;

  // 🎨 Render OG SVG
  const svgResponse = await renderOgImage({
    title,
    content: `${slug}.quicksites.ai`,
    theme,
    brand,
    logoUrl,
  });

  const svg = await svgResponse.text();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
  // const png = new Resvg(svg).render().asPng();

  // 💾 Upload to Supabase Storage
  await supabase.storage.from(bucket).upload(path, svg, {
    contentType: 'image/png',
    upsert: true,
  });

  // 🌐 Update og_image_url in DB
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  await supabase.from('published_sites').update({ og_image_url: publicUrl }).eq('slug', slug);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
