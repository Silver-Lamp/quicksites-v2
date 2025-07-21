'use client';

import { useEffect } from 'react';
import { pingSearchEngines } from '@/lib/pingSearchEngines';

export function useAutoPingOnPublish(published: boolean, slug: string) {
  useEffect(() => {
    if (!published || !slug) return;

    const sitemapUrl = `https://quicksites.ai/sitemap.xml`;
    pingSearchEngines(sitemapUrl);
  }, [published, slug]);
}
