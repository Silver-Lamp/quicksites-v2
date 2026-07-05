// lib/marketingOg.ts
//
// Builds Next `Metadata` for a marketing page with a branded Open Graph /
// Twitter card, pointing at the `app/api/og/marketing` image generator. Keeps
// the openGraph/twitter boilerplate in one place so each page just declares its
// copy. Page-scoped (used per page, not in the org-aware root layout).
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://quicksites.ai';

export function marketingOg(opts: {
  /** <title> + og:title + twitter:title */
  title: string;
  /** meta description + og/twitter description */
  description: string;
  /** canonical path, e.g. '/partners' */
  path: string;
  /** OG card eyebrow (small caps line); defaults to the domain in the route */
  ogEyebrow?: string;
  /** OG card headline; defaults to `title` */
  ogTitle?: string;
  /** OG card subtitle; defaults to `description` */
  ogSubtitle?: string;
  /** Brand-aware overrides (reseller orgs) — default to QuickSites in the route */
  brand?: string;
  /** Accent hex, e.g. '#0ea5e9'; only a valid #RRGGBB is honored by the route */
  accent?: string;
  /** Footer domain, e.g. 'cedarsites.com' */
  domain?: string;
  /** openGraph siteName; defaults to 'QuickSites' */
  siteName?: string;
}): Metadata {
  const params = new URLSearchParams();
  if (opts.ogEyebrow) params.set('eyebrow', opts.ogEyebrow);
  params.set('title', opts.ogTitle ?? opts.title);
  params.set('subtitle', opts.ogSubtitle ?? opts.description);
  if (opts.brand) params.set('brand', opts.brand);
  if (opts.accent) params.set('accent', opts.accent);
  if (opts.domain) params.set('domain', opts.domain);
  const image = `/api/og/marketing?${params.toString()}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: 'website',
      url: opts.path,
      siteName: opts.siteName ?? 'QuickSites',
      title: opts.title,
      description: opts.description,
      images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}
