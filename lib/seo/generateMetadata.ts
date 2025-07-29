import type { Template } from '@/types/template';
import type { Metadata } from 'next';

export function generatePageMetadata({
  site,
  pageSlug,
  baseUrl,
}: {
  site: Template;
  pageSlug: string;
  baseUrl: string;
}): Metadata {
  const pages = site.data?.pages || [];
  const currentPage = pages.find((p) => p.slug === pageSlug);

  const ogImage = `https://quicksites.ai/storage/v1/object/public/og-cache/og-${site.slug}-${pageSlug}.png`;

  return {
    title: currentPage?.meta?.title || currentPage?.title || site.template_name,
    description: currentPage?.meta?.description || site.description || 'A site built with QuickSites.',
    openGraph: {
      title: currentPage?.meta?.title || site.template_name,
      description: currentPage?.meta?.description || site.description,
      url: `${baseUrl}/${pageSlug}`,
      images: [ogImage],
    },
    icons: {
      icon: site.logo_url || '/favicon.ico',
    },
  };
}
