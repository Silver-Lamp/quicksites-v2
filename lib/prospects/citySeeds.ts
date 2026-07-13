// lib/prospects/citySeeds.ts
//
// City seeds for the domain buy-list planner: turn one metro into the ~30 surrounding
// cities/suburbs worth fanning a category across, and harvest the cities already swept.
// Pure + no I/O so it unit-tests and runs in the client bundle. See
// docs/DOMAIN_ACQUISITION_PLAN.md §5.

export type CitySeed = { city: string; region: string };

/**
 * Curated metro → surrounding cities. Seeds the "fan a category across a region" play so an
 * operator doesn't hand-type 30 suburbs. Extend as new target metros come online — the
 * planner also accepts an explicit city list and harvests swept cities, so this is a
 * convenience, not the only source.
 */
export const METRO_CITY_SEEDS: Record<string, CitySeed[]> = {
  // Seattle / Renton (the default outreach org's service area)
  seattle: [
    { city: 'Seattle', region: 'WA' },
    { city: 'Bellevue', region: 'WA' },
    { city: 'Renton', region: 'WA' },
    { city: 'Kent', region: 'WA' },
    { city: 'Auburn', region: 'WA' },
    { city: 'Federal Way', region: 'WA' },
    { city: 'Kirkland', region: 'WA' },
    { city: 'Redmond', region: 'WA' },
    { city: 'Bothell', region: 'WA' },
    { city: 'Burien', region: 'WA' },
    { city: 'SeaTac', region: 'WA' },
    { city: 'Tukwila', region: 'WA' },
    { city: 'Shoreline', region: 'WA' },
    { city: 'Issaquah', region: 'WA' },
    { city: 'Sammamish', region: 'WA' },
    { city: 'Kenmore', region: 'WA' },
    { city: 'Maple Valley', region: 'WA' },
    { city: 'Covington', region: 'WA' },
    { city: 'Des Moines', region: 'WA' },
    { city: 'Mercer Island', region: 'WA' },
    { city: 'Newcastle', region: 'WA' },
    { city: 'Woodinville', region: 'WA' },
    { city: 'Lynnwood', region: 'WA' },
    { city: 'Edmonds', region: 'WA' },
    { city: 'Everett', region: 'WA' },
    { city: 'Puyallup', region: 'WA' },
    { city: 'Tacoma', region: 'WA' },
    { city: 'Lakewood', region: 'WA' },
  ],
  // Greater Boston (the boston-towing.com example region)
  boston: [
    { city: 'Boston', region: 'MA' },
    { city: 'Cambridge', region: 'MA' },
    { city: 'Somerville', region: 'MA' },
    { city: 'Quincy', region: 'MA' },
    { city: 'Newton', region: 'MA' },
    { city: 'Brookline', region: 'MA' },
    { city: 'Medford', region: 'MA' },
    { city: 'Malden', region: 'MA' },
    { city: 'Everett', region: 'MA' },
    { city: 'Revere', region: 'MA' },
    { city: 'Chelsea', region: 'MA' },
    { city: 'Waltham', region: 'MA' },
    { city: 'Watertown', region: 'MA' },
    { city: 'Arlington', region: 'MA' },
    { city: 'Belmont', region: 'MA' },
    { city: 'Lynn', region: 'MA' },
    { city: 'Framingham', region: 'MA' },
    { city: 'Dedham', region: 'MA' },
    { city: 'Needham', region: 'MA' },
    { city: 'Braintree', region: 'MA' },
    { city: 'Weymouth', region: 'MA' },
    { city: 'Milton', region: 'MA' },
    { city: 'Woburn', region: 'MA' },
    { city: 'Randolph', region: 'MA' },
  ],
};

/** Normalize a metro name to a seeds key (case/space/punctuation insensitive). */
export function normalizeMetroKey(metro: string): string {
  return (metro || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Cities for a metro name, or [] if we don't have a curated seed for it. */
export function citiesForMetro(metro: string): CitySeed[] {
  return METRO_CITY_SEEDS[normalizeMetroKey(metro)] ?? [];
}

/** The metros we have curated seeds for (for a picker). */
export function availableMetros(): string[] {
  return Object.keys(METRO_CITY_SEEDS);
}

type CityRow = { city?: string | null; region?: string | null };

/**
 * Harvest the distinct (city, region) pairs already present in swept prospects — the
 * real, grounded city set to fan a category across. Deduped case-insensitively; first-seen
 * casing wins; sorted by city then region.
 */
export function citiesFromProspects(rows: CityRow[]): CitySeed[] {
  const seen = new Map<string, CitySeed>();
  for (const r of rows) {
    const city = (r.city || '').trim();
    if (!city) continue;
    const region = (r.region || '').trim();
    const key = `${city.toLowerCase()}::${region.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, { city, region });
  }
  return [...seen.values()].sort((a, b) => a.city.localeCompare(b.city) || a.region.localeCompare(b.region));
}
