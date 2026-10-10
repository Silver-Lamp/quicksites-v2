// lib/vashon/restaurantOrdering.ts
//
// Which Vashon Island restaurants take online orders, and through whom — read from each
// restaurant's OWN website on the date below (the homepage was fetched and its ordering links
// detected; Google's listing supplied the site). It feeds the restaurant section of /for-abdou.
//
// ⚠️ A SNAPSHOT THAT SAYS SO. Unlike the no-website table on that page (live from the sweep),
// this cannot be re-derived from the database: an ordering platform is only visible by reading
// the restaurant's site. So it is dated, the page shows the date, and the honest reading of a row
// is "on <date>, their homepage linked X" — never "they use X today". A homepage-only read also
// misses a link kept on a subpage, which is why NONE is phrased as "no online ordering found",
// not "no online ordering".
//
// Only what the site itself shows: name, the platform linked, Google's review count for ordering
// the list. Nothing is said about any business beyond that.

export type OrderingPlatform = 'toast' | 'square' | 'bentobox' | 'wix' | 'none';

export type IslandRestaurant = {
  name: string;
  /** Google review count on the read date — used only to order the list. */
  reviews: number;
  platform: OrderingPlatform;
  /** True when Google lists no website and the only web presence is the platform's page. */
  noOwnSite?: boolean;
};

export const RESTAURANT_ORDERING_READ_ON = '2026-10-10';

export const ISLAND_RESTAURANTS: IslandRestaurant[] = [
  // Toast — linked from their own site
  { name: 'The Hardware Store Restaurant', reviews: 1507, platform: 'toast' },
  { name: 'Island Queen', reviews: 361, platform: 'toast' },
  { name: 'O Sole Mio', reviews: 278, platform: 'toast' },
  { name: 'Camp Colvos Brewing', reviews: 234, platform: 'toast' },
  { name: 'Pizzeria Mario', reviews: 26, platform: 'toast' },
  // Toast — no website of their own; Google links the Toast page
  { name: 'Casa Bonita', reviews: 557, platform: 'toast', noOwnSite: true },
  { name: 'Lunetta — Wood-fired Pizza & Housemade Pastas', reviews: 180, platform: 'toast', noOwnSite: true },
  { name: 'Little Cup Coffee', reviews: 168, platform: 'toast', noOwnSite: true },
  // Square
  { name: 'Pop Pop Bottle Shop', reviews: 102, platform: 'square' },
  { name: 'Syrian Kitchen', reviews: 47, platform: 'square' },
  { name: 'Ramble Restaurant', reviews: 39, platform: 'square' },
  { name: 'Wine Shop Vashon', reviews: 23, platform: 'square' },
  // Other
  { name: 'May Kitchen + Bar', reviews: 518, platform: 'bentobox' },
  { name: 'Cafe Luna', reviews: 249, platform: 'wix' },
  // No ordering link found on the homepage
  { name: 'Snapdragon', reviews: 675, platform: 'none' },
  { name: 'Vashon Island Coffee Roasterie', reviews: 623, platform: 'none' },
  { name: 'The Ruby Brink', reviews: 350, platform: 'none' },
  { name: 'Zamorana', reviews: 347, platform: 'none' },
  { name: 'The Rock Island Pizza', reviews: 234, platform: 'none' },
  { name: 'Burton Coffee Stand', reviews: 197, platform: 'none' },
  { name: "Anu Rana's Healthy Kitchen", reviews: 144, platform: 'none' },
  { name: "Iyad's Syrian Grill", reviews: 133, platform: 'none' },
  { name: 'Vashon Pizza', reviews: 124, platform: 'none' },
  { name: 'Sandpiper Cafe', reviews: 64, platform: 'none' },
  { name: "Dragon's Head Cider Uptown", reviews: 53, platform: 'none' },
];

export const PLATFORM_LABEL: Record<OrderingPlatform, string> = {
  toast: 'Toast',
  square: 'Square',
  bentobox: 'BentoBox',
  wix: 'Wix Restaurants',
  none: 'no online ordering found',
};

export function byPlatform(platform: OrderingPlatform): IslandRestaurant[] {
  return ISLAND_RESTAURANTS.filter((r) => r.platform === platform).sort((a, b) => b.reviews - a.reviews);
}

/** The three groups the rep page shows, in pitch order. */
export function islandRestaurantGroups() {
  return {
    /** Call these first: a site exists, no ordering does — the no-monthly fee is a real win. */
    noOrdering: byPlatform('none'),
    /** Offer a site that links their Toast page; never pitch replacing the ordering. */
    toastNoSite: ISLAND_RESTAURANTS.filter((r) => r.platform === 'toast' && r.noOwnSite).sort((a, b) => b.reviews - a.reviews),
    /** Skip: on Toast with their own site, or on Square (free ordering, nothing to undercut). */
    leaveAlone: ISLAND_RESTAURANTS.filter((r) => (r.platform === 'toast' && !r.noOwnSite) || r.platform === 'square' || r.platform === 'bentobox' || r.platform === 'wix').sort((a, b) => b.reviews - a.reviews),
  };
}
