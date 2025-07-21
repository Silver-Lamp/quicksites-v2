import { ImageResponse } from 'next/og';
import { getSupabase } from '@/lib/supabase/server';
import { cacheOgImage } from '@/lib/og/cacheOgImage';

export const runtime = 'edge';

export async function GET(_: Request, { params }: { params: { slug: string; page: string } }) {
  const { slug, page } = params;
  const supabase = await getSupabase();

  const { data: site } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  const pages = site?.data?.pages || [];
  const pageData = pages.find((p: any) => p.slug === page);
  const title = pageData?.meta?.title || pageData?.title || site?.template_name;
  const heroImg = pageData?.content_blocks?.find((b: any) => b.type === 'hero')?.content?.image_url;
  const fallback = site?.logo_url || 'https://quicksites.ai/default-og.png';

  const img = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: 'black',
          color: 'white',
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
            style={{ objectFit: 'cover', position: 'absolute', zIndex: -1, opacity: 0.3 }}
          />
        )}
        <img src={fallback} alt="Logo" width={96} height={96} style={{ marginBottom: 20 }} />
        <strong>{title}</strong>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );

  const imgBuffer = await (img as any).arrayBuffer();
  const publicUrl = await cacheOgImage(slug, page, Buffer.from(imgBuffer));
  return new Response(await img.arrayBuffer(), { headers: { 'Content-Type': 'image/png' } });
}
