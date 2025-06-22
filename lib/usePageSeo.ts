import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getPageSeo } from './seo';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SiteSeoFields = {
  domain?: string;
  seo_title?: string;
  seo_description?: string;
  twitter_handle?: string;
  site_name?: string;
};

export function usePageSeo({
  title,
  description,
  noindex = false,
}: {
  title?: string;
  description: string;
  noindex?: boolean;
}) {
  const { pathname, asPath } = useRouter();
  const [site, setSite] = useState<SiteSeoFields>({});

  useEffect(() => {
    const slug = pathname.split('/')[1]; // assumes /edit/[slug] or /view/[slug]

    if (!slug) return;

    supabase
      .from('sites')
      .select('domain, seo_title, seo_description, twitter_handle, site_name')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        if (data) setSite(data);
      });
  }, [pathname]);

  const derivedTitle =
    title ||
    site.seo_title ||
    pathname
      .replace(/^\//, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Home';

  const siteUrl = site.domain
    ? `https://${site.domain}`
    : process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  const fullUrl = `${siteUrl}${asPath}`;

  return {
    ...getPageSeo({
      title: derivedTitle,
      description: description || site.seo_description || '',
      slug: pathname,
    }),
    ...(noindex && { robots: 'noindex,nofollow' }),
    canonical: fullUrl,
    openGraph: {
      url: fullUrl,
      title: derivedTitle,
      description: description || site.seo_description || '',
      site_name: site.site_name || 'QuickSites',
      type: 'website',
    },
    twitter: {
      handle: site.twitter_handle || '@QuickSitesAI',
      site: site.twitter_handle || '@QuickSitesAI',
      cardType: 'summary_large_image',
    },
  };
}
