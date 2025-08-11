// app/api/og/[slug]/image/route.ts
import { renderOgImage } from '@/lib/og/renderOgImage';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  const bucket = 'og-cache';
  // Use SVG consistently for cache path + content type
  const path = `snapshots/${slug}.svg`;

  // Serve cached SVG if present
  const { data: cached } = await supabase.storage.from(bucket).download(path);
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  // Fetch published site + branding
  const { data: site } = await supabase
    .from('published_sites')
    .select('*, branding_profiles(name, theme, brand, logo_url)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  const title = site?.branding_profiles?.name || slug;
  const theme = site?.branding_profiles?.theme || 'dark';
  const brand = site?.branding_profiles?.brand || 'green';
  const logo_url = site?.branding_profiles?.logo_url; // ← canonical key

  // Render OG as SVG
  const svgResponse = await renderOgImage({
    title,
    content: `${slug}.quicksites.ai`,
    theme,
    brand,
    logo_url, // ← pass canonical key expected by renderOgImage()
  });

  const svg = await svgResponse.text();

  // Upload to Supabase Storage (SVG)
  await supabase.storage.from(bucket).upload(path, svg, {
    contentType: 'image/svg+xml',
    upsert: true,
  });

  // Update og_image_url to the public SVG URL
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  await supabase
    .from('published_sites')
    .update({ og_image_url: publicUrl })
    .eq('slug', slug);

  // Return freshly rendered SVG
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
