// lib/geoCache.ts

type GeoEntry = { lat: number; lon: number };

const localGeoCache: Record<string, GeoEntry> = {};

function makeKey(city: string, state: string): string {
  return `${city.trim().toLowerCase()},${state.trim().toLowerCase()}`;
}

/**
 * Retrieve from local memory cache
 */
export function getCachedGeo(city: string, state: string): GeoEntry | undefined {
  return localGeoCache[makeKey(city, state)];
}

/**
 * Store in local memory cache
 */
export function setCachedGeo(city: string, state: string, lat: number, lon: number): void {
  localGeoCache[makeKey(city, state)] = { lat, lon };
}
