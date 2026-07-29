// lib/places/photoProxy.ts
//
// Google Places photo URLs, without shipping the API key to the browser.
//
// THE BUG THIS EXISTS TO FIX: `lib/rebuild/importListing.ts` built photo URLs as
//   https://maps.googleapis.com/maps/api/place/photo?...&key=${GOOGLE_PLACES_API_KEY}
// and stored them verbatim in `templates.data`. Anything that renders a listing-import site
// then emitted the key into public HTML, and `GET /api/public/restaurant-directory` returned
// it three times in one unauthenticated JSON response. Anyone could harvest it and bill the
// owner's Google account.
//
// The fix is to store the `photo_reference` (which is NOT a secret — it is meaningless
// without a key) and resolve it through a server-side proxy that holds the key.

/** Places photo references are URL-safe base64-ish. Anything else is not ours. */
const REF_RE = /^[A-Za-z0-9_\-]{20,1000}$/;

export function isValidPhotoReference(ref: string): boolean {
  return REF_RE.test(ref || '');
}

/** The public, keyless URL a site should store and render. */
export function placePhotoProxyUrl(ref: string, maxWidth = 1600): string {
  return `/api/public/place-photo?ref=${encodeURIComponent(ref)}&w=${maxWidth}`;
}

/**
 * Pull the `photo_reference` out of a legacy keyed Google URL, so the backfill can rewrite
 * stored values without re-hitting Places. Returns null when the string isn't one of ours
 * (already proxied, a plain upload, an empty string).
 */
export function photoReferenceFromLegacyUrl(url: string): string | null {
  if (!url || !url.includes('maps.googleapis.com')) return null;
  const m = /[?&]photo_reference=([^&]+)/.exec(url);
  if (!m) return null;
  const ref = decodeURIComponent(m[1]);
  return isValidPhotoReference(ref) ? ref : null;
}

/**
 * Rewrite a stored photo URL to the keyless proxy form. Idempotent: a value that is already
 * proxied, or was never a Places URL, comes back untouched — so the backfill can be re-run.
 */
export function toProxiedPhotoUrl(url: string, maxWidth = 1600): string {
  const ref = photoReferenceFromLegacyUrl(url);
  return ref ? placePhotoProxyUrl(ref, maxWidth) : url;
}

/** True when a string still carries an `AIza…` key — the assertion the tests and backfill use. */
export function leaksApiKey(s: string): boolean {
  return /[?&]key=AIza/.test(s || '');
}

/** The name to reach for at a storage boundary. Same rewrite, intent-revealing. */
export const sanitizePersistedPhotoUrl = toProxiedPhotoUrl;

/**
 * Deep-rewrite every keyed Places photo URL inside an arbitrary JSON value.
 *
 * This is the belt to `sanitizePersistedPhotoUrl`'s braces. A draft is a big nested blob and
 * photo URLs turn up in more places than any one call site knows about — hero `image_url`,
 * gallery arrays, menu item images, `meta`. Chasing each assignment is how one gets missed;
 * sanitising the whole object on the way into `templates.data` cannot miss one.
 *
 * Pure and idempotent: already-proxied values and non-Places strings pass through unchanged,
 * so it is safe to apply more than once and safe to re-run over the fleet.
 */
export function stripPlacesKeysDeep<T>(value: T): T {
  if (typeof value === 'string') return toProxiedPhotoUrl(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => stripPlacesKeysDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripPlacesKeysDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
