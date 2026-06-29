// lib/home/featured-sites.ts
//
// Priority ordering for the homepage "Built with QuickSites" showcase. The
// showcase shows ALL publishable published sites (those with a business name,
// industry, or hero image); these slugs are pinned to the front in this order.
// Everything else follows alphabetically. Admins can hide individual sites at
// runtime (persisted; see showcase_hidden_slugs). Add a slug here to feature it
// first — note a site only appears once it's actually published.

export const FEATURED_SITE_SLUGS: string[] = [
  'pnw-exteriorcleaning', // shows automatically once published
  'graftontowing',
  'southhilltowing',
  'florencetow',
  'deliveredmenu',
];
