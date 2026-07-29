// lib/site/siteMap.ts
//
// The curated top-level map of QuickSites' public surfaces. ONE source, consumed by both the
// 404 page and /sitemap — per the mesh advisory (crosstalk 20260727-015522), whose whole point
// is that a lost visitor should be handed the entire map rather than a "Go Home" button.
//
// ⚠️ EVERY LINK HERE WAS VERIFIED 200 BEFORE BEING ADDED (2026-07-29). A sitemap that points
// at dead ends is worse than no sitemap: it takes someone who is already lost and loses them
// again, with our name on it. If you add an entry, curl it first.
//
// Deliberately EXCLUDED, so the omissions read as choices rather than oversights:
//   /personas          secret-gated, draft-only
//   /secondset         flag-gated OFF
//   /for-<name>        unlisted warm-intro pages, noindex by design
//   /whats-new-smoke, /not-found-trigger, /pnw-prestige   internal probes + one-offs
//   /admin, /merchant, /dashboard, /profile               authenticated surfaces
//
// This is a HUMAN map (grouped, searchable), not the machine one — /sitemap.xml already
// exists and serves crawlers.

export type SiteMapLink = {
  href: string;
  label: string;
  /** One line, shown under the label. Written for someone who is lost, not for SEO. */
  blurb?: string;
};

export type SiteMapGroup = {
  title: string;
  links: SiteMapLink[];
};

export const SITE_MAP: SiteMapGroup[] = [
  {
    title: 'Build a site',
    links: [
      { href: '/', label: 'Home', blurb: 'What QuickSites is, in a minute.' },
      { href: '/build', label: 'Start building free', blurb: 'Describe your business, watch a real site appear.' },
      { href: '/rebuild', label: 'Rebuild from a URL', blurb: 'Point us at an existing site and we rebuild it.' },
      { href: '/pricing', label: 'Pricing', blurb: 'Free hosting; we earn on commerce, not subscriptions.' },
      { href: '/features', label: 'Features', blurb: 'Builder, storefront, CRM, domains.' },
      { href: '/bring-your-domain', label: 'Bring your own domain' },
    ],
  },
  {
    title: 'Compare',
    links: [
      { href: '/compare', label: 'QuickSites vs the others', blurb: 'Honest comparisons — including where they win.' },
      { href: '/best-website-builders-2026', label: 'Best website builders 2026' },
    ],
  },
  {
    title: 'Partners & resellers',
    links: [
      { href: '/partners', label: 'Become a partner', blurb: 'Resell the builder, earn on every order.' },
      { href: '/partners/calculator', label: 'Earnings calculator', blurb: 'What a book of clients is actually worth.' },
      { href: '/partners/resellers', label: 'For agencies' },
    ],
  },
  {
    title: 'Browse local businesses',
    links: [
      { href: '/restaurants', label: 'Restaurants' },
      { href: '/delivered', label: 'delivered.menu', blurb: 'Order direct from local kitchens — no delivery-app markup.' },
      { href: '/realtors', label: 'Real estate' },
      { href: '/local-services', label: 'Local services' },
    ],
  },
  {
    title: 'Work with us',
    links: [
      { href: '/gigs', label: 'Store-walk gigs', blurb: 'Flexible ~20-minute local gigs.' },
      { href: '/walker', label: 'Walk board', blurb: 'Your claimed gigs and route.' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/contact', label: 'Contact us' },
      { href: '/book', label: 'Book a call' },
      { href: '/search', label: 'Search' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Terms of service' },
    ],
  },
];

/** Case-insensitive match across label, blurb and href — so "menu" finds delivered.menu. */
export function filterSiteMap(groups: SiteMapGroup[], query: string): SiteMapGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      links: g.links.filter((l) =>
        `${l.label} ${l.blurb ?? ''} ${l.href} ${g.title}`.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.links.length > 0);
}
