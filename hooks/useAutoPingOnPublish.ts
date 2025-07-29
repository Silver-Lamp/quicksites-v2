'use client';

import { useEffect } from 'react';
import { pingSearchEngines } from '@/lib/pingSearchEngines';

export function useAutoPingOnPublish(published: boolean, slug: string, custom_domain?: string) {
  useEffect(() => {
    if (!published || !slug) return;

    const sitemapUrl = custom_domain
      ? `https://${custom_domain}/sitemap.xml`
      : `https://quicksites.ai/_sites/${slug}/sitemap.xml`;

    pingSearchEngines(sitemapUrl, slug);
  }, [published, slug, custom_domain]);
}
