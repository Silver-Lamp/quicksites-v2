// /app/_sites/[slug]/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function TenantSitePage({ params }: { params: { slug: string } }) {
  const supabase = await getSupabase();

  const { data: site, error } = await supabase
    .from('public_sites') // or 'sites', adjust as needed
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!site || error) return notFound();

  return (
    <>
      <head>
        <title>{site.seo_title || site.business_name}</title>
        <meta name="description" content={site.seo_description || ''} />
        <link rel="canonical" href={`https://${params.slug}.quicksites.ai`} />
      </head>
      <main>
        <h1 className="text-3xl font-bold">{site.business_name}</h1>
        <div dangerouslySetInnerHTML={{ __html: site.content }} />
      </main>
    </>
  );
}
