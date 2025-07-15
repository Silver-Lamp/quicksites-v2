import SiteEditor from '@/components/site/site-editor';
import { getServerSupabaseClient } from '@/lib/supabase/serverClient';
import { notFound } from 'next/navigation';

export default async function EditSitePage({ params }: { params: { slug: string } }) {
  const supabase = getServerSupabaseClient();
  const { slug } = params;

  const { data: site, error } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !site) return notFound();

  return <SiteEditor site={site} />;
}
