// lib/parks/seedParks.ts
//
// Lazy, on-demand population of the industrial-park registry. When a pitch site needs a
// grounded office address in an area we haven't covered yet, ensureParksForArea sweeps
// Google Places Text Search ONCE for that area, stores the parks, and records the sweep
// so it never re-hits Places for the same area again (the registry is the cache).
//
// Places has no "industrial_park" type, so we discover parks by keyword Text Search.

import { getLatLonForCityState } from '@/lib/utils/geocode';
import { searchTextNearby } from '@/lib/places/searchTextNearby';
import { isIndustrialPark } from './suiteScheme';
import { splitFormatted } from './keys';
import {
  parksRegistryEnabled,
  hasAreaBeenSwept,
  getParksForArea,
  upsertParks,
  recordAreaSweep,
  type Park,
  type ParkInput,
} from './registry';

/**
 * Keyword queries that surface INDUSTRIAL / WAREHOUSE parks (there is no Places type for
 * them). Deliberately excludes "business park" / "flex office" — those magnet in coworking
 * and executive-office operators, which isIndustrialPark() then also filters by name.
 */
const PARK_QUERIES = [
  'industrial park',
  'warehouse for lease',
  'light industrial space for lease',
  'distribution center',
  'industrial flex space',
];

const SWEEP_RADIUS_METERS = 12_000; // ~7.5mi — parks are metro-scale, not block-scale.

export { splitFormatted } from './keys';

/**
 * Sweep Places for parks in an area and store them. Records the sweep (even 0 parks) so it
 * won't re-run. On a geocode/Places failure it does NOT record the sweep (so a transient
 * outage retries next time) and returns []. Best-effort throughout.
 */
export async function seedParksForArea(
  city: string,
  region: string | null | undefined,
  sweptBy: string | null = null,
): Promise<Park[]> {
  const geo = await getLatLonForCityState(city, region ?? undefined);
  if (!geo) return []; // don't record — let it retry once geocoding works

  let found;
  try {
    found = await searchTextNearby({
      lat: geo.lat,
      lon: geo.lon,
      radiusMeters: SWEEP_RADIUS_METERS,
      textQueries: PARK_QUERIES,
      maxPerQuery: 20,
    });
  } catch {
    return []; // Places not configured / transient — don't poison the coverage log
  }

  // Drop coworking / executive-office operators — we only want industrial/warehouse space.
  const industrial = found.filter((b) => isIndustrialPark(b.name));

  const rows: ParkInput[] = industrial.map((b) => {
    const s = splitFormatted(b.address);
    return {
      placeId: b.placeId,
      name: b.name,
      street: s.street,
      city: s.city ?? city,
      region: s.region ?? (region ?? null),
      postalCode: s.postalCode,
      lat: b.lat ?? null,
      lng: b.lon ?? null,
      matchedQuery: b.matchedQuery,
    };
  });

  await upsertParks(rows);
  await recordAreaSweep({
    city,
    region,
    lat: geo.lat,
    lng: geo.lon,
    radiusMeters: SWEEP_RADIUS_METERS,
    parksFound: industrial.length,
    sweptBy,
  });

  return getParksForArea(city, region);
}

/**
 * Return the parks for an area, pulling+storing them from Places on first touch. This is
 * the "run it whenever needed" entry point — call it while building a site in an area and
 * it self-populates once, then serves from the registry forever after. Returns [] when the
 * feature flag is off.
 */
export async function ensureParksForArea(
  city: string,
  region: string | null | undefined,
  sweptBy: string | null = null,
): Promise<Park[]> {
  if (!parksRegistryEnabled()) return [];
  const c = (city ?? '').trim();
  if (!c) return [];
  if (await hasAreaBeenSwept(c, region)) return getParksForArea(c, region);
  return seedParksForArea(c, region, sweptBy);
}
