// lib/home/featured-sites.ts
//
// Fallback priority for the homepage "Built with QuickSites" showcase.
//
// ⚠️ THIS LIST DOES NOT WIN, AND ITS OLD COMMENT SAID IT DID. It claimed these slugs were "pinned
// to the front"; they are not. `getShowcaseData` sorts every slug present in
// `site_settings.showcase_order` (the admin drag order) ahead of every slug that is not, so a
// featured site the saved order has never heard of lands *behind all of it*. Measured 2026-09-26:
// `pnw-exteriorcleaning` was first here and **16th of 130 in the live public feed**, while an
// admin saw it first in their own browser from their local drag state. This list only breaks ties
// among sites the admin order does not mention.
//
// ⚠️ To actually put a site first, use the ★ on its card (super-admin, homepage) — it writes the
// full `showcase_order`. Editing this file will not do it.
//
// Ordering principle for what follows: real business names, no demos, no `starter-*` seeds, and
// INDUSTRY VARIETY at the front. The row led with five towing companies in a row, which reads as
// "this is a towing tool" to everyone who is not a tow operator.

export const FEATURED_SITE_SLUGS: string[] = [
  'pnw-exteriorcleaning', // exterior cleaning — owner's pick
  'graftontowing', // towing — the deepest site we have (9 pages)
  'renton-plumbing', // plumbing
  'auburnroofcleaning', // roof cleaning
  'arlington-electrical', // electrical
  'arlington-hvac', // hvac
  'arlo-v-books', // author — the non-trade vertical
  'southhilltowing',
  'framingham-plumbing',
  'covingtontow',
  // 'deliveredmenu' removed 2026-07-27: `published=true` with NO published snapshot, so its card
  // linked to a page that rendered the marketing homepage instead of a site.
  // ⚠️ 'local', 'ecopest', 'luxeglow' are NOT eligible — their names end in "— Demo". They are
  // filtered out at source now (`looksLikeDemo`), not merely left out of this list.
];
