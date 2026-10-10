// lib/prospects/orderingSegments.ts
//
// The three-way split a rep page shows for restaurants, as a pure function over prospect rows.
//
//   call        — a site of their own, read, and no ordering link found. Pitch first.
//   siteOnly    — on Toast (or another first-party platform) with NO site of their own: Google's
//                 "website" IS the ordering page. Offer a site that links it; never the ordering.
//   thirdParty  — orders only through DoorDash/Grubhub/UberEats. A commission to undercut.
//   leaveAlone  — a first-party platform and a site of their own. Nothing to offer today.
//   unchecked   — nobody has read the site yet. Shown as a count, NEVER folded into "call".
//
// ⚠️ NULL ordering_platform means nobody looked. The first version of this list was a
// hand-typed snapshot (lib/vashon/restaurantOrdering.ts, deleted the same week); this one reads
// the sweep rows, so a re-check moves a restaurant between groups without a deploy.

import { THIRD_PARTY, type OrderingPlatform } from '@/lib/prospects/orderingDetect';

export type RestaurantRow = {
  id: string;
  business_name: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  ordering_platform: string | null;
  ordering_checked_at: string | null;
  template_id: string | null;
};

export type RestaurantGroups<T extends RestaurantRow = RestaurantRow> = {
  call: T[];
  siteOnly: T[];
  thirdParty: T[];
  leaveAlone: T[];
  unchecked: T[];
};

const PLATFORM_HOSTS: Array<[OrderingPlatform, RegExp]> = [
  ['toast', /toasttab\.com|toast\.app/i],
  ['square', /squareup\.com|square\.site/i],
  ['clover', /clover\.com/i],
  ['doordash', /doordash\.com/i],
  ['grubhub', /grubhub\.com/i],
  ['ubereats', /ubereats\.com/i],
];

/** When Google's "website" for a business is itself an ordering page, they have no site of their own. */
export function platformFromWebsiteHost(website: string | null): OrderingPlatform | null {
  if (!website) return null;
  for (const [p, re] of PLATFORM_HOSTS) if (re.test(website)) return p;
  return null;
}

/**
 * Is this row actually a place that serves food or drink, by Google's own types? The sweep's
 * `industry_key` comes from the text query that found the row ("restaurants near …" stamps
 * `restaurant` on whatever Google returned), so a vet clinic and two accountants on Vashon
 * carried it. Google's `categories` are the business's own types; empty categories pass (we
 * cannot say either way), a list with no food type does not.
 */
const FOOD_TYPE = /restaurant|cafe|coffee|\bbar\b|bakery|meal_|food|pizza|brewery|brewpub|winery|cider|deli|diner|tea_house|ice_cream|juice|sandwich|taco|sushi|bistro|pub\b/i;
export function looksLikeFoodBusiness(categories: string[] | null | undefined): boolean {
  if (!categories || categories.length === 0) return true;
  return categories.some((c) => FOOD_TYPE.test(c));
}

export function groupRestaurantsByOrdering<T extends RestaurantRow>(rows: T[]): RestaurantGroups<T> {
  const g: RestaurantGroups<T> = { call: [], siteOnly: [], thirdParty: [], leaveAlone: [], unchecked: [] };
  for (const r of rows) {
    if (!r.website) continue; // the no-website table owns these
    const hostPlatform = platformFromWebsiteHost(r.website);
    if (hostPlatform) {
      (THIRD_PARTY.has(hostPlatform) ? g.thirdParty : g.siteOnly).push(r);
      continue;
    }
    if (!r.ordering_checked_at || !r.ordering_platform) {
      g.unchecked.push(r);
      continue;
    }
    const p = r.ordering_platform as OrderingPlatform;
    if (p === 'none') g.call.push(r);
    else if (THIRD_PARTY.has(p)) g.thirdParty.push(r);
    else g.leaveAlone.push(r);
  }
  const byReviews = (a: T, b: T) => (b.review_count ?? 0) - (a.review_count ?? 0);
  for (const k of Object.keys(g) as Array<keyof RestaurantGroups<T>>) g[k].sort(byReviews);
  return g;
}

export const PLATFORM_LABEL: Record<OrderingPlatform, string> = {
  toast: 'Toast',
  square: 'Square',
  clover: 'Clover',
  bentobox: 'BentoBox',
  wix_restaurants: 'Wix Restaurants',
  chownow: 'ChowNow',
  popmenu: 'Popmenu',
  slice: 'Slice',
  owner: 'Owner.com',
  menufy: 'Menufy',
  olo: 'Olo',
  shopify: 'Shopify',
  doordash: 'DoorDash',
  grubhub: 'Grubhub',
  ubereats: 'Uber Eats',
  none: 'no online ordering found',
};

export function platformLabel(p: string | null): string {
  return (PLATFORM_LABEL as Record<string, string>)[p ?? ''] ?? (p ? p.replace(/_/g, ' ') : 'not checked');
}
