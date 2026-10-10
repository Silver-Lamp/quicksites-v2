// lib/prospects/siteProvider.ts
//
// Who hosts a business's current website, decided from the site's own HTML — asset hosts,
// generator meta tags and platform-specific markup, never a brand name in prose (the
// storefrontDetect rule: hicustom.com says "Shopify" in a form label and is not a store).
//
// Why it exists: the Evolve page (/evolve/<prospectId>) shows a restaurant what it is likely
// paying for its site today. We can only say that honestly when (a) we can see who serves the
// site and (b) that provider publishes pricing we have already sourced in the compare cluster
// (lib/compare/competitors.ts). For a provider we detect but have no sourced pricing for, the
// page names the provider and says nothing about cost. 'custom' means "read, no known builder".

import { competitorBySlug, pricesVerifiedFor } from '@/lib/compare/competitors';

export type SiteProvider =
  | 'wix'
  | 'squarespace'
  | 'godaddy'
  | 'wordpress_com'
  | 'wordpress'
  | 'weebly'
  | 'duda'
  | 'webflow'
  | 'shopify'
  | 'bentobox'
  | 'popmenu'
  | 'toast'
  | 'custom';

/** Order matters: the first match wins, and the specific restaurant builders come first. */
const SIGNATURES: Array<[SiteProvider, RegExp]> = [
  ['bentobox', /getbento\.com|bentobox/i],
  ['popmenu', /popmenu\.com|popmenucloud/i],
  ['toast', /toasttab\.com\/sites|toast-sites|toasttab\.com\/local/i],
  ['wix', /static\.parastorage\.com|static\.wixstatic\.com|wix\.com\/|X-Wix-|wixsite\.com|<meta name="generator" content="Wix/i],
  ['squarespace', /static1\.squarespace\.com|squarespace\.com|sqsp\.net|<meta name="generator" content="Squarespace/i],
  ['godaddy', /img1\.wsimg\.com|godaddysites\.com|secureserver\.net\/.*websitebuilder|<meta name="generator" content="Starfield/i],
  ['weebly', /weebly\.com|editmysite\.com/i],
  ['duda', /multiscreensite\.com|duda\.co|dudamobile/i],
  ['webflow', /assets\.website-files\.com|webflow\.com|<meta name="generator" content="Webflow/i],
  ['shopify', /cdn\.shopify\.com|myshopify\.com|Shopify\.theme/i],
  ['wordpress_com', /files\.wordpress\.com|wp\.com\/|wordpress\.com\//i],
  ['wordpress', /\/wp-content\/|\/wp-includes\/|<meta name="generator" content="WordPress/i],
];

export function detectSiteProvider(html: string): SiteProvider {
  for (const [p, re] of SIGNATURES) if (re.test(html)) return p;
  return 'custom';
}

export const PROVIDER_LABEL: Record<SiteProvider, string> = {
  wix: 'Wix',
  squarespace: 'Squarespace',
  godaddy: 'GoDaddy Website Builder',
  wordpress_com: 'WordPress.com',
  wordpress: 'WordPress (self-hosted)',
  weebly: 'Weebly',
  duda: 'Duda',
  webflow: 'Webflow',
  shopify: 'Shopify',
  bentobox: 'BentoBox',
  popmenu: 'Popmenu',
  toast: 'Toast Websites',
  custom: 'a custom or unknown host',
};

export function providerLabel(p: string | null | undefined): string {
  return (PROVIDER_LABEL as Record<string, string>)[p ?? ''] ?? (p ? p.replace(/_/g, ' ') : 'not read yet');
}

/**
 * The provider's PUBLISHED pricing, read from the compare cluster where it is sourced and dated.
 * Null for a provider we have not sourced — the page then names the provider without a figure.
 */
export function providerPublishedPricing(p: string | null | undefined): { pricing: string; verified: string; sources: { label: string; url: string }[] } | null {
  const slug = p === 'wordpress_com' ? null : p; // not in the cluster
  if (!slug) return null;
  const c = competitorBySlug(slug);
  if (!c) return null;
  return { pricing: c.pricing, verified: pricesVerifiedFor(c), sources: c.sources.map((s) => ({ label: s.label, url: s.url })) };
}
