// lib/places/searchText.ts
//
// Name-based Places lookup (Places API NEW: places:searchText) — find a specific business
// by "name + city" and read its websiteUri. Complements searchNearby (location+type). Used
// to backfill whether a migrated legacy lead actually has a website. Paid SKU (Text Search).

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
].join(',');

export class PlacesTextError extends Error {
  code: 'not_configured' | 'fetch_failed';
  constructor(code: PlacesTextError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'PlacesTextError';
  }
}

export type TextMatch = {
  placeId: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  rating: number | null;
  reviewCount: number | null;
};

function mapPlace(p: any): TextMatch | null {
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
    rating: Number.isFinite(p?.rating) ? p.rating : null,
    reviewCount: Number.isFinite(p?.userRatingCount) ? p.userRatingCount : null,
  };
}

/** Best Places match for a free-text business query (e.g. "Ray's Towing, Red Bay AL"), or null. */
export async function searchPlaceByText(query: string, fetchImpl: typeof fetch = fetch): Promise<TextMatch | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesTextError('not_configured', 'GOOGLE_PLACES_API_KEY is not set.');
  const textQuery = query.trim();
  if (!textQuery) return null;

  let res: Response;
  try {
    res = await fetchImpl(SEARCH_TEXT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    });
  } catch (e: any) {
    throw new PlacesTextError('fetch_failed', e?.message || 'Places text search failed.');
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PlacesTextError(res.status === 403 ? 'not_configured' : 'fetch_failed', json?.error?.message || `Places text search failed (${res.status}).`);
  }
  const first = Array.isArray(json?.places) ? json.places[0] : null;
  return first ? mapPlace(first) : null;
}
