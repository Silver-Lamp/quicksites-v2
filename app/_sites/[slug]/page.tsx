// /app/_sites/[slug]/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'iad1';

import TemplateRenderer from '@/components/template-renderer';
import { getSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Head from 'next/head';
import { useEffect } from 'react';
import { DevToolsToggler } from '@/components/DevToolsToggler';

export default async function SitePage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug;
  if (!slug) return notFound();

  const supabase = await getSupabase();
  const { data: site, error } = await supabase
    .from('public_sites')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!site || error) return notFound();

  const ogImageUrl = `https://quicksites.ai/api/og/${slug}/image`;

  let resolvedOgUrl = site.og_image_url || ogImageUrl;

  try {
    const ogResponse = await fetch(ogImageUrl, {
      headers: { accept: 'image/*' },
      next: { revalidate: 60 },
    });
    const contentType = ogResponse.headers.get('content-type') || '';
    if (ogResponse.ok && contentType.includes('image')) {
      const finalUrl = ogResponse.url;
      if (finalUrl !== site.og_image_url) {
        await supabase
          .from('public_sites')
          .update({ og_image_url: finalUrl })
          .eq('slug', slug);
        resolvedOgUrl = finalUrl;
      }
    }
  } catch (err) {
    console.warn('⚠️ OG image prefetch failed:', err);
  }

  // useEffect(() => {
  //   const minimized = localStorage.getItem('devtools:minimized');
  //   if (minimized === 'true') {
  //     document.documentElement.classList.add('devtools-minimized');
  //   } else {
  //     document.documentElement.classList.remove('devtools-minimized');
  //   }
  // }, []);

  return (
    <>
      <DevToolsToggler />
      <Head>
        <title>{site.seo_title || site.business_name}</title>
        <meta name="description" content={site.seo_description || ''} />
        <link rel="canonical" href={`https://${slug}.quicksites.ai`} />

        <meta property="og:title" content={site.seo_title || site.business_name} />
        <meta property="og:description" content={site.seo_description || ''} />
        <meta property="og:image" content={resolvedOgUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://${slug}.quicksites.ai`} />
      </Head>

      <TemplateRenderer siteSlug={slug}>
        <h1 className="text-2xl font-bold mb-4">{site.business_name}</h1>
        <div
          className="text-sm text-zinc-300"
          dangerouslySetInnerHTML={{ __html: site.data }}
        />
      </TemplateRenderer>
    </>
  );
}
