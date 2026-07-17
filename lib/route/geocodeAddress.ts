// lib/route/geocodeAddress.ts
//
// Turn a street address into coordinates for the route planner — the piece that lets a
// tasker type store addresses instead of raw lat/lon (crosstalk ideas.md §19). Uses the
// SAME free OpenStreetMap Nominatim geocoder the repo already uses (lib/utils/geocode.ts),
// so there's no new vendor and no per-call cost. Cached per-process + politeness-sequenced
// (Nominatim asks for ≤1 req/sec + a real User-Agent, which we honor).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const UA = 'QuickSites-RoutePlanner/1.0 (support@quicksites.ai)';

export type GeoPoint = { latitude: number; longitude: number; display?: string };

// Per-process cache — taskers hit the same stores repeatedly, so this cuts most calls.
const cache = new Map<string, GeoPoint | null>();
const norm = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ');

/** Geocode one address → point (or null if not found). Cached. `fetchImpl` injectable for tests. */
export async function geocodeAddress(address: string, fetchImpl: typeof fetch = fetch): Promise<GeoPoint | null> {
  const key = norm(address);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(address.trim())}`;
  let point: GeoPoint | null = null;
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.ok) {
      const data: any = await res.json().catch(() => null);
      if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
        const latitude = parseFloat(data[0].lat);
        const longitude = parseFloat(data[0].lon);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          point = { latitude, longitude, display: typeof data[0].display_name === 'string' ? data[0].display_name : undefined };
        }
      }
    }
  } catch {
    point = null;
  }
  cache.set(key, point);
  return point;
}

/**
 * Geocode many addresses, SEQUENTIALLY (Nominatim politeness). Cache hits are instant;
 * only uncached addresses actually hit the network, so a warm planner is fast. Returns
 * results in input order (null where not found).
 */
export async function geocodeAll(addresses: string[], fetchImpl: typeof fetch = fetch): Promise<(GeoPoint | null)[]> {
  const out: (GeoPoint | null)[] = [];
  for (const a of addresses) {
    out.push(await geocodeAddress(a, fetchImpl));
  }
  return out;
}
