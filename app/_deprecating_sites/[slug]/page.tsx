// app/sites/[slug]/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';

export default async function SiteSlugRedirectPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const supabase = await getServerSupabase();

  const { data: site, error } = await supabase
    .from('templates')
    .select('data')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site || error || !site.data?.pages?.length) return notFound();

  const firstPageSlug = site.data.pages[0].slug || 'home';

  redirect(`/sites/${slug}/${firstPageSlug}`);
}
