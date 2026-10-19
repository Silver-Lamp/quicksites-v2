// lib/ppl/islandFence.ts — an island campaign may only be pointed at a business ON the island.
//
// Distance is no fence across water: a 25 km market around Vashon reached Renton (the HVAC
// recommender ranked mainland firms for vashon-handyman, 2026-10-08) and a 3 km Places bias on
// Whidbey returned Stanwood and Anacortes. Worse, the island-wide Whidbey campaigns carry the
// city "Whidbey Island", which no address or prospect row ever says — so a city-equality lookup
// finds nobody and the follow-up text reads "last free one" while Clinton has a second shop.
//
// So: a campaign city that names an island group maps to the town names its prospects actually
// carry, and both the forward-to recommender and the pitch's "next business" lookup keep to
// them. Pure; one table; adding an island = one line. A campaign city not listed here is not an
// island and the fence says nothing (null).
export const ISLAND_GROUPS: Record<string, string[]> = {
  'vashon': ['Vashon'],
  'whidbey island': ['Oak Harbor', 'Coupeville', 'Greenbank', 'Freeland', 'Langley', 'Clinton'],
  'oak harbor': ['Oak Harbor'],
  'coupeville': ['Coupeville'],
  'freeland': ['Freeland'],
  'langley': ['Langley'],
  'clinton': ['Clinton'],
  'bainbridge island': ['Bainbridge Island'],
};

const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();

/** The prospect towns an island campaign may draw from, or null when the city is not an island. */
export function islandTownsFor(campaignCity: string | null | undefined): string[] | null {
  return ISLAND_GROUPS[norm(campaignCity)] ?? null;
}

/** true/false for an island campaign; null when the campaign is not on an island (no opinion). */
export function prospectOnIsland(campaignCity: string | null | undefined, prospectCity: string | null | undefined): boolean | null {
  const towns = islandTownsFor(campaignCity);
  if (!towns) return null;
  const p = norm(prospectCity);
  return towns.some((t) => t.toLowerCase() === p);
}

/** The `.in('city', …)` list a lookup should use for a campaign: the island's towns, else the city itself. */
export function cityListFor(campaignCity: string | null | undefined): string[] {
  return islandTownsFor(campaignCity) ?? (campaignCity ? [campaignCity] : []);
}
