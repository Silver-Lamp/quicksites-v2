'use server';

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteRenderer from '@/components/sites/site-renderer';
import { generatePageMetadata } from '../../../../lib/seo/generateMetadata';

export async function generateMetadata({ params }: { params: { slug: string; page: string } }): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: site } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site) return {};

  return generatePageMetadata({
    site,
    pageSlug: params.page,
    baseUrl: 'https://quicksites.ai/sites',
  });
}

export default async function SitePage({ params }: { params: { slug: string; page: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: site, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site || error) return notFound();

  return (
    <SiteRenderer
      site={site}
      page={params.page}
      baseUrl="https://quicksites.ai/sites"
      enableThemeWrapper
    />
  );
}
