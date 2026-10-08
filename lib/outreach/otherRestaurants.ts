// lib/outreach/otherRestaurants.ts
//
// "More places to eat and drink in <city>": the restaurants near a competition apex that
// ALREADY have a website, listed below the cohort as plain outbound links.
//
// Why it exists (owner, 2026-10-08, vashon-restaurants.com): an apex that lists only the two
// restaurants we built reads as a two-item advert; one that lists every place on the island,
// linking the others to their own sites, reads as the directory the domain name promises.
// Nothing is claimed about any of them — name, their own URL, Google rating. That is all the
// sweep knows and all this says.
//
// ⚠️ THE FILTER IS THE WORK. The sweep's `restaurant` industry key is a guess from the query
// that surfaced a place, and the Vashon sweep filed three CPAs, a vet clinic and a garden
// centre under it. Membership here is decided from Google's own `types`, never from our key:
// something that serves food, or a bar/brewery/winery Google also tags `food`. A tax office is
// not a place to eat, whatever query found it.
import { supabaseAdmin } from '@/lib/supabase/admin';

export type OtherRestaurant = {
  name: string;
  website: string;
  rating: number | null;
  reviewCount: number | null;
};

const EATERY_TYPES = new Set([
  'restaurant',
  'cafe',
  'coffee_shop',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'food_court',
  'ice_cream_shop',
  'dessert_shop',
  'sandwich_shop',
  'deli',
  'diner',
]);
const DRINK_TYPES = new Set(['bar', 'brewery', 'winery', 'wine_bar', 'pub', 'bar_and_grill', 'cider_bar']);

/** Pure. Does Google's type list describe a place that serves food (or drink with food)? */
export function isFoodListing(categories: readonly string[] | null | undefined): boolean {
  const types = (categories ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (!types.length) return false;
  if (types.some((t) => EATERY_TYPES.has(t) || t.endsWith('_restaurant'))) return true;
  // A bar is a place to drink; it earns a spot on an eating list only when Google also calls
  // it `food` (Camp Colvos, Dragon's Head). A garden centre with a bar does not.
  return types.some((t) => DRINK_TYPES.has(t)) && types.includes('food');
}

/** A website we can send a diner to: absolute http(s), nothing else. */
export function usableWebsite(raw: string | null | undefined): string | null {
  const u = String(raw ?? '').trim();
  if (!u || u.toLowerCase() === 'no site') return null;
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const parsed = new URL(withScheme);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Restaurants in the campaign's city that have their own website and are not in the cohort,
 * most-reviewed first. Capped so a dense city stays a list, not a database dump.
 */
export async function loadOtherRestaurants(opts: {
  city: string;
  region: string | null;
  excludeProspectIds: Iterable<string>;
  limit?: number;
}): Promise<OtherRestaurant[]> {
  if (!opts.city) return [];
  const exclude = new Set(opts.excludeProspectIds);
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, website, categories, rating, review_count')
    .eq('city', opts.city)
    .not('website', 'is', null)
    .neq('website', '')
    .limit(400);
  if (opts.region) q = q.eq('region', opts.region);
  const { data } = await q;
  const seen = new Set<string>();
  return ((data ?? []) as Array<{ id: string; business_name: string | null; website: string | null; categories: string[] | null; rating: number | null; review_count: number | null }>)
    .filter((r) => !exclude.has(r.id))
    .filter((r) => (r.business_name ?? '').trim() && isFoodListing(r.categories))
    .map((r) => ({ name: (r.business_name ?? '').trim(), website: usableWebsite(r.website), rating: r.rating ?? null, reviewCount: r.review_count ?? null }))
    .filter((r): r is OtherRestaurant => !!r.website)
    // One link per site: "Pizzeria Mario" and "O Sole Mio" share a site; so do The Yard and
    // the Hardware Store. The higher-reviewed name keeps the row.
    .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || a.name.localeCompare(b.name))
    .filter((r) => {
      const key = new URL(r.website).hostname.replace(/^www\./, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, opts.limit ?? 60);
}
