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
  canonicalIsExact = false,
}: {
  site: Template;
  pageSlug: string;
  baseUrl: string;
  /**
   * `baseUrl` is already this page's full public URL — use it as the canonical unchanged.
   *
   * ⚠️ The default (`false`) builds `baseUrl + '/' + pageSlug`, which is how published sites came
   * to declare `https://theirdomain.com/sites/home` as canonical: the caller passed
   * `origin + '/sites'` and the page slug, and the visitor's real URL — `https://theirdomain.com/`
   * — appeared nowhere in the calculation. Callers that know the public URL should say so rather
   * than hand over parts to be reassembled into a guess.
   */
  canonicalIsExact?: boolean;
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

  // Live themed OG route (lib/og/siteOgCard) — real hero or the site's curated
  // accent card. Always fresh + CDN-cached (s-maxage), so no separate og-cache
  // pipeline to keep in sync. Site-level: the same card for all pages.
  const ogImage = joinUrl('https://quicksites.ai', `/og/${(site as any)?.slug ?? 'site'}`);

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

  const canonical = canonicalIsExact ? baseUrl : joinUrl(baseUrl, pageSlug);
  const siteName = (site as any)?.template_name || title;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      url: canonical,
      images: [ogImage],
    },
    // Rich card when a local business site is shared on X/Twitter.
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    icons,
  };
}
