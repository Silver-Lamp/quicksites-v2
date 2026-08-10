// lib/seo/generateMetadata.ts
import type { Template } from '@/types/template';
import type { Metadata } from 'next';
import { buildPageTitle } from './pageTitle';

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

  // ⚠️ The old chain was `page.meta.title || page.title || template_name`, and the builder names
  // the first page "Home" — so `page.title` always existed and the site name was never reached.
  // Every site in the fleet served <title>Home</title>. See lib/seo/pageTitle.ts.
  const meta = (site as any)?.data?.meta ?? {};
  const contact = meta.contact ?? {};
  const heroHeadline = (() => {
    const blocks = [...(currentPage?.content_blocks ?? []), ...(currentPage?.blocks ?? [])];
    const v = blocks.find((b: any) => b?.type === 'hero')?.content?.headline;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  })();

  const title = buildPageTitle({
    seoTitle: currentPage?.meta?.title ?? meta.seo_title,
    pageTitle: currentPage?.title,
    siteName: meta.business_name ?? meta.siteTitle ?? (site as any)?.template_name,
    heroHeadline,
    city: contact.city,
    region: contact.state,
    isHomePage: !!currentPage && pages.indexOf(currentPage) === 0,
  });

  // ⚠️ "A site built with QuickSites." was the fallback DESCRIPTION on a customer's own page —
  // the sentence Google may print under their business name, advertising their vendor. Same shape
  // as the title bug: our product's identity standing in for theirs. Prefer what the owner
  // actually wrote (the hero subheadline is a real sentence about their business), and if there
  // is nothing, emit no description at all — an absent tag lets a search engine pull a snippet
  // from the page, which beats a sentence about somebody else.
  const heroSub = (() => {
    const blocks = [...(currentPage?.content_blocks ?? []), ...(currentPage?.blocks ?? [])];
    const hero = blocks.find((b: any) => b?.type === 'hero');
    const v = hero?.content?.subheadline;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  })();

  const description =
    currentPage?.meta?.description ||
    (site as any)?.description ||
    meta.seo_description ||
    heroSub ||
    undefined;

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
