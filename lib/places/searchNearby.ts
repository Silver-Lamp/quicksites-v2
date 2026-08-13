// lib/places/searchNearby.ts
//
// The geographic fan-out primitive for the "businesses near me" lead-gen feature:
// given a lat/lon + radius + business categories, return nearby businesses WITH their
// website (or lack of one) — the core lead signal.
//
// Uses the Places API (NEW): POST places.googleapis.com/v1/places:searchNearby with a
// field mask, so `websiteUri` comes back IN the search response — no per-result Place
// Details call (a big cost saver on a radius sweep). Reuses GOOGLE_PLACES_API_KEY; the
// New Places API must be enabled in GCP for that key.
//
// Note: Nearby Search (New) caps at 20 results per call and has NO page token. To widen
// coverage we issue one request per includedType and dedupe by place id — passing N
// categories naturally yields up to ~20*N businesses.

const SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
/** Shared response field mask — reused by the Text Search primitive. */
// ⚠️ EVERY FIELD HERE COSTS. Places bills by SKU: id/name/address/location are Essentials, but
// rating and userRatingCount push the call into a pricier tier. They are included deliberately —
// see below — not because "more data is better".
//
// ⚠️ WHY rating + userRatingCount ARE WORTH THE SKU. The no-website cohorts we build sites for have
// almost nothing we can honestly say about them: a name, a phone, an address. For restaurants we
// recovered a MENU from listing photos, and that menu — specific, theirs, usually with a flaw we
// could own — is the only reason the outreach messages read as written by a person. Auto shops (66%
// no-website, the largest cohort found) have no menu. Their public reviews are the closest thing to
// "their own words" available, and `outreach_prospects` has carried unused `rating` /
// `review_count` columns the whole time.
export const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
].join(',');

export class PlacesError extends Error {
  code: 'not_configured' | 'fetch_failed' | 'invalid';
  constructor(code: PlacesError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'PlacesError';
  }
}

export type NearbyBusiness = {
  placeId: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  /** Google star rating, or null when the place has none. Never 0 — see mapPlace. */
  rating?: number | null;
  /** How many reviews that rating is built on. A 5.0 from 2 people is not a 5.0 from 200. */
  reviewCount?: number | null;
  types: string[];
};

export type SearchNearbyArgs = {
  lat: number;
  lon: number;
  /** Meters. Places API (New) allows 0–50000; we clamp into range. */
  radiusMeters: number;
  /** Google Places type ids, e.g. ['restaurant','plumber','hair_care']. */
  includedTypes: string[];
  /** Max results requested per type (Places caps at 20). */
  maxPerType?: number;
};

/** Map a raw Places (New) place object to our lead shape. Shared with Text Search. */
export function mapPlace(p: any): NearbyBusiness | null {
  const placeId = typeof p?.id === 'string' ? p.id : null;
  if (!placeId) return null;
  return {
    placeId,
    name: (p?.displayName?.text ?? '').toString().trim() || 'Business',
    website: typeof p?.websiteUri === 'string' && p.websiteUri ? p.websiteUri : null,
    phone: typeof p?.nationalPhoneNumber === 'string' ? p.nationalPhoneNumber : null,
    address: typeof p?.formattedAddress === 'string' ? p.formattedAddress : null,
    lat: Number.isFinite(p?.location?.latitude) ? p.location.latitude : null,
    lon: Number.isFinite(p?.location?.longitude) ? p.location.longitude : null,
    types: Array.isArray(p?.types) ? p.types.map((t: unknown) => String(t)) : [],
    // ⚠️ null, never 0. A shop with no rating and a shop rated 0.0 are different facts, and a 0
    // would sort to the bottom of any "worst reviews first" list as though it were measured.
    rating: Number.isFinite(p?.rating) ? Number(p.rating) : null,
    reviewCount: Number.isFinite(p?.userRatingCount) ? Number(p.userRatingCount) : null,
  };
}

async function searchOneType(
  args: { lat: number; lon: number; radiusMeters: number; includedType: string; maxResultCount: number; key: string },
  fetchImpl: typeof fetch,
): Promise<NearbyBusiness[]> {
  const body = {
    includedTypes: [args.includedType],
    maxResultCount: args.maxResultCount,
    locationRestriction: {
      circle: {
        center: { latitude: args.lat, longitude: args.lon },
        radius: args.radiusMeters,
      },
    },
  };

  let res: Response;
  try {
    res = await fetchImpl(SEARCH_NEARBY_URL, {
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
    // A disabled/unauthorized API surfaces as 403 — treat as not_configured so the
    // route can tell the operator to enable the New Places API.
    throw new PlacesError(res.status === 403 ? 'not_configured' : 'fetch_failed', msg);
  }

  const places = Array.isArray(json?.places) ? json.places : [];
  return places.map(mapPlace).filter(Boolean) as NearbyBusiness[];
}

/**
 * Sweep an area for businesses across the given categories. One request per included
 * type (Nearby Search New caps at 20/call, no pagination); results deduped by place id.
 * `fetchImpl` is injectable for tests.
 */
export async function searchNearby(
  args: SearchNearbyArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<NearbyBusiness[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesError('not_configured', 'GOOGLE_PLACES_API_KEY is not set.');

  const lat = Number(args.lat);
  const lon = Number(args.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new PlacesError('invalid', 'A valid lat/lon is required.');
  }
  const types = (args.includedTypes ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (!types.length) throw new PlacesError('invalid', 'At least one business category is required.');

  const radiusMeters = Math.min(50_000, Math.max(1, Math.round(Number(args.radiusMeters) || 1500)));
  const maxResultCount = Math.min(20, Math.max(1, args.maxPerType ?? 20));

  const byPlaceId = new Map<string, NearbyBusiness>();
  for (const includedType of types) {
    const found = await searchOneType({ lat, lon, radiusMeters, includedType, maxResultCount, key }, fetchImpl);
    for (const b of found) {
      if (!byPlaceId.has(b.placeId)) byPlaceId.set(b.placeId, b);
    }
  }
  return [...byPlaceId.values()];
}
