// lib/places/searchTextNearby.ts
//
// Keyword companion to searchNearby for the "businesses near me" sweep. Many
// high-value no-website trades (towing, HVAC, landscaping, handyman, pest
// control, junk removal, …) have NO Google Places (New) place type, so a
// type-only Nearby Search can never surface them. Text Search (New) matches on a
// free-text query instead, biased to the sweep circle. (Distinct from
// searchText.ts's searchPlaceByText, which resolves ONE named business.)
//
// Uses the Places API (NEW): POST places.googleapis.com/v1/places:searchText with
// the same field mask, so websiteUri (the core lead signal) comes back in the
// search response — no per-result Place Details call. Reuses GOOGLE_PLACES_API_KEY.
//
// Note: Text Search circles must be a locationBias (locationRestriction only
// accepts a rectangle), so results can spill slightly outside the radius — fine
// for lead-gen. Caps at 20 results per call (we don't paginate).

import { PlacesError, mapPlace, PLACES_FIELD_MASK, type NearbyBusiness } from './searchNearby';

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

/** A sweep result tagged with the query that surfaced it (for industry classification). */
export type TextNearbyBusiness = NearbyBusiness & { matchedQuery: string };

export type SearchTextNearbyArgs = {
  lat: number;
  lon: number;
  /** Meters. Places API (New) allows 0–50000; clamped into range. */
  radiusMeters: number;
  /** Free-text category queries, e.g. ['towing service', 'HVAC contractor']. */
  textQueries: string[];
  /** Max results requested per query (Places caps at 20). */
  maxPerQuery?: number;
};

async function searchOneQuery(
  args: { lat: number; lon: number; radiusMeters: number; textQuery: string; maxResultCount: number; key: string },
  fetchImpl: typeof fetch,
): Promise<NearbyBusiness[]> {
  const body = {
    textQuery: args.textQuery,
    maxResultCount: args.maxResultCount,
    locationBias: {
      circle: {
        center: { latitude: args.lat, longitude: args.lon },
        radius: args.radiusMeters,
      },
    },
  };

  let res: Response;
  try {
    res = await fetchImpl(SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': args.key,
        'X-Goog-FieldMask': PLACES_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    throw new PlacesError('fetch_failed', e?.message || 'Places request failed.');
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new PlacesError('fetch_failed', `Places returned a non-JSON response (${res.status}).`);
  }
  if (!res.ok) {
    const msg = json?.error?.message || `Places request failed (${res.status}).`;
    throw new PlacesError(res.status === 403 ? 'not_configured' : 'fetch_failed', msg);
  }

  const places = Array.isArray(json?.places) ? json.places : [];
  return places.map(mapPlace).filter(Boolean) as NearbyBusiness[];
}

/**
 * Sweep an area for businesses matching free-text category queries. One request
 * per query (Text Search New caps at 20/call, no pagination); results deduped by
 * place id. `fetchImpl` is injectable for tests.
 */
export async function searchTextNearby(
  args: SearchTextNearbyArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<TextNearbyBusiness[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesError('not_configured', 'GOOGLE_PLACES_API_KEY is not set.');

  const lat = Number(args.lat);
  const lon = Number(args.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new PlacesError('invalid', 'A valid lat/lon is required.');
  }
  const queries = (args.textQueries ?? []).map((q) => String(q).trim()).filter(Boolean);
  if (!queries.length) return [];

  const radiusMeters = Math.min(50_000, Math.max(1, Math.round(Number(args.radiusMeters) || 1500)));
  const maxResultCount = Math.min(20, Math.max(1, args.maxPerQuery ?? 20));

  const byPlaceId = new Map<string, TextNearbyBusiness>();
  for (const textQuery of queries) {
    const found = await searchOneQuery({ lat, lon, radiusMeters, textQuery, maxResultCount, key }, fetchImpl);
    for (const b of found) {
      // First query to surface a place wins the dedupe (and owns its industry tag).
      if (!byPlaceId.has(b.placeId)) byPlaceId.set(b.placeId, { ...b, matchedQuery: textQuery });
    }
  }
  return [...byPlaceId.values()];
}
