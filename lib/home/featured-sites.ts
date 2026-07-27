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
  // 'deliveredmenu' removed 2026-07-27: it was `published=true` with NO published snapshot,
  // so its showcase card linked to a page that rendered the marketing homepage instead of a
  // site. Unpublished at the same time. Re-add only if it is genuinely published.
];
