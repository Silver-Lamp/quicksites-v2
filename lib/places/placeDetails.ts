// lib/places/placeDetails.ts
//
// Place Details (Places API NEW) for GBP prominence signals — rating + review count +
// category. Keyed on the place_id we already store per prospect. NOTE: rating/reviews
// are a paid ("Enterprise") SKU — call this throttled (weekly), never per page load.

const FIELD_MASK = 'id,rating,userRatingCount,primaryType,types,businessStatus';

export type PlaceSignals = {
  rating: number | null;
  reviewCount: number | null;
  primaryType: string | null;
  businessStatus: string | null;
};

export function placeDetailsConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

/** Fetch public GBP-derived signals for a place. Returns null on any failure (best-effort). */
export async function fetchPlaceDetails(
  placeId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaceSignals | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !placeId) return null;
  try {
    const res = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return {
      rating: typeof j?.rating === 'number' ? j.rating : null,
      reviewCount: typeof j?.userRatingCount === 'number' ? j.userRatingCount : null,
      primaryType: typeof j?.primaryType === 'string' ? j.primaryType : null,
      businessStatus: typeof j?.businessStatus === 'string' ? j.businessStatus : null,
    };
  } catch {
    return null;
  }
}
