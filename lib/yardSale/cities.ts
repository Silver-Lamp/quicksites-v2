// lib/yardSale/cities.ts
//
// The cities that get their own "list your yard sale in <city>" page.
//
// ⚠️ FIVE, NOT FIFTY-FIVE, AND THE SMALL NUMBER IS THE DESIGN. `METRO_CITY_SEEDS` already holds
// ~55 cities and it would be one line to fan across all of them. Don't. Pages that differ only by
// a swapped city name are what Google calls DOORWAY PAGES — a penalty category, and the penalty
// lands on the whole domain, including the front door that works today. The defence is that each
// page says something genuinely true of that city, and with no sales in the database yet there is
// very little that is genuinely true and local. So the honest position is: publish few, say only
// what we can support, and widen only if these rank.
//
// ⚠️ SELLER INTENT, NEVER BUYER INTENT. These target "list your yard sale in Renton" — a promise we
// can keep today, because the page delivers exactly the thing it offers. The bigger query
// ("yard sales near me", 10k–100k/mo) is buyer intent, and ranking for it now would put a searcher
// in front of an empty weekend. Never add copy here that promises shoppers; see
// docs/YARDSALE_TOOL_HANDOFF.md §1.
//
// The cluster is deliberate too: five ADJACENT South King County cities, not five scattered ones.
// Adjacency is what makes the cross-links honest — a sale in Tukwila really is near Burien — and
// it means the first real sale lends weight to several pages at once instead of stranding four.

export type YardSaleCity = {
  /** URL segment. Region-suffixed so a same-named city elsewhere can be added without a clash. */
  slug: string;
  city: string;
  region: string;
  county: string;
  /** Slugs of adjacent cities in this list. Must be mutual — enforced by test. */
  neighbors: string[];
};

export const YARD_SALE_CITIES: YardSaleCity[] = [
  { slug: 'renton-wa',  city: 'Renton',  region: 'WA', county: 'King County', neighbors: ['kent-wa', 'tukwila-wa', 'seatac-wa'] },
  { slug: 'kent-wa',    city: 'Kent',    region: 'WA', county: 'King County', neighbors: ['renton-wa', 'tukwila-wa', 'seatac-wa'] },
  { slug: 'tukwila-wa', city: 'Tukwila', region: 'WA', county: 'King County', neighbors: ['renton-wa', 'kent-wa', 'burien-wa', 'seatac-wa'] },
  { slug: 'burien-wa',  city: 'Burien',  region: 'WA', county: 'King County', neighbors: ['tukwila-wa', 'seatac-wa'] },
  { slug: 'seatac-wa',  city: 'SeaTac',  region: 'WA', county: 'King County', neighbors: ['renton-wa', 'kent-wa', 'tukwila-wa', 'burien-wa'] },
];

export function findCity(slug: string): YardSaleCity | null {
  const s = (slug || '').trim().toLowerCase();
  return YARD_SALE_CITIES.find((c) => c.slug === s) ?? null;
}

export function neighborsOf(c: YardSaleCity): YardSaleCity[] {
  return c.neighbors.map(findCity).filter((x): x is YardSaleCity => !!x);
}

/** "Renton, WA" — used in headings, titles and structured data so they cannot drift apart. */
export function cityLabel(c: YardSaleCity): string {
  return `${c.city}, ${c.region}`;
}
