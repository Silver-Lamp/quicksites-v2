// lib/seo/generateMetadata.ts
import type { Template } from '@/types/template';
import type { Metadata } from 'next';

function trimSlashStart(s: string) {
  return s.replace(/^\/+/, '');
}
function trimSlashEnd(s: string) {
  return s.replace(/\/+$/, '');
}
function joinUrl(base: string, path: string) {
  return `${trimSlashEnd(base)}/${trimSlashStart(path)}`;
}

function resolveFaviconUrl(site: any): string | null {
  // Primary location we write to via commits
  const fromDataMeta = site?.data?.meta?.favicon_url;
  // Secondary fallbacks in case older records stored it differently
  const fallbacks = [
    site?.meta?.favicon_url,
    site?.data?.favicon_url,
    site?.favicon_url,
  ];

  const pick =
    (typeof fromDataMeta === 'string' && fromDataMeta.trim()) ||
    fallbacks.find((v) => typeof v === 'string' && v.trim());

  return pick ? String(pick) : null;
}

export function generatePageMetadata({
  site,
  pageSlug,
  baseUrl,
}: {
  site: Template;
  pageSlug: string;
  baseUrl: string;
}): Metadata {
  const pages = (site as any)?.data?.pages || [];
  const currentPage =
    pages.find((p: any) => p?.slug === pageSlug) || null;

  const title =
    currentPage?.meta?.title ||
    currentPage?.title ||
    (site as any)?.template_name ||
    'QuickSites';

  const description =
    currentPage?.meta?.description ||
    (site as any)?.description ||
    'A site built with QuickSites.';

  const ogImage = joinUrl(
    'https://quicksites.ai/storage/v1/object/public/og-cache',
    `og-${(site as any)?.slug ?? 'site'}-${pageSlug}.png`
  );

  // --- Favicon / icons ---
  const favicon = resolveFaviconUrl(site);
  let icons: Metadata['icons'] | undefined;

  if (favicon) {
    // Provide multiple rels to satisfy different browsers
    icons = {
      icon: [
        { url: favicon, sizes: '32x32', type: 'image/png' },
        { url: favicon, rel: 'shortcut icon' },
      ],
      apple: [{ url: favicon, sizes: '180x180' }],
    };
  } else {
    // Fallback to your static default
    icons = { icon: '/favicon.ico' };
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: joinUrl(baseUrl, pageSlug),
      images: [ogImage],
    },
    icons,
  };
}
