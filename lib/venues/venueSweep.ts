// lib/venues/venueSweep.ts
//
// "Which places near this city have live music?" — one capability, two consumers: HiveJournal's
// Cornerstone Display "Live music" panel (crosstalk/contracts/venue-sweep.md — the contract is the
// single source of truth; this file implements it, never forks it) and, later, a QS venue vertical
// seeding prospects for the Laguna Beach test market.
//
// Served from the place-search seam we already have (lib/places/searchNearby + searchTextNearby)
// rather than a second Google key: three text queries ("live music", "live music bar",
// "music venue") + two venue types (night_club, bar), deduped by place id, sorted by review
// count, capped at 40. NO AI spend, no scraping; Places terms apply.
//
// ⚠️ A venue on this list means Places thinks it is a bar / club / matched "live music". It is
// NOT a schedule, and the `note` on every response says so; HJ never renders it as one.

import { searchNearby, PlacesError, type NearbyBusiness } from '@/lib/places/searchNearby';
import { searchTextNearby, type TextNearbyBusiness } from '@/lib/places/searchTextNearby';
import { getLatLonForCityState } from '@/lib/utils/geocode';

export const VENUE_TEXT_QUERIES = ['live music', 'live music bar', 'music venue'] as const;
export const VENUE_TYPES = ['night_club', 'bar'] as const;
export const VENUE_CAP = 40;
export const RADIUS_DEFAULT = 5000;
export const RADIUS_MIN = 500;
export const RADIUS_MAX = 50_000;
export const VENUE_NOTE = 'Google Places results; presence on this list is not a schedule.';

/** The one kind defined today. Unknown kinds are a 400 at the route. */
export const VENUE_KINDS = ['live_music'] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

export type VenueSignal = 'text' | 'type' | 'name';

export type Venue = {
  place_id: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  lat: number | null;
  lon: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  types: string[];
  signal: VenueSignal;
};

export type VenueSweepInput = {
  city?: string;
  region?: string;
  lat?: number;
  lon?: number;
  radiusMeters?: number;
  kinds?: string[];
};

export type VenueSweepResult = {
  ok: true;
  center: { lat: number; lon: number; label: string };
  venues: Venue[];
  note: string;
};

export class VenueSweepError extends Error {
  status: 400 | 422 | 501 | 502;
  code: string;
  constructor(status: VenueSweepError['status'], code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'VenueSweepError';
  }
}

export function clampRadius(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return RADIUS_DEFAULT;
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(n)));
}

/**
 * "214 Ocean Ave, Laguna Beach, CA 92651, USA" → { city: 'Laguna Beach', region: 'CA' }.
 * Best-effort on the US formatted address Places returns; anything else → nulls. Pure.
 */
export function parseCityRegion(address: string | null | undefined): { city: string | null; region: string | null } {
  if (!address) return { city: null, region: null };
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  // Drop a trailing country token ("USA", "United States").
  if (parts.length >= 3 && /^(usa|united states|us|canada|ca)$/i.test(parts[parts.length - 1])) parts.pop();
  if (parts.length < 2) return { city: null, region: null };
  const regionZip = parts[parts.length - 1]; // "CA 92651"
  const city = parts[parts.length - 2];
  const m = /^([A-Z]{2})\b/.exec(regionZip);
  return { city: city || null, region: m ? m[1] : null };
}

const NAME_RE = /\b(live music|music hall|music venue|concert|lounge|tavern|saloon|cabaret|jazz|blues)\b/i;

/** Great-circle distance in metres. Pure. */
export function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Merge the text-search and type-search results into one ranked, deduped venue list. A place
 * found by BOTH keeps signal `text` (the stronger evidence). Sorted by review count desc, nulls
 * last, then name. Pure; exported for tests.
 *
 * ⚠️ `within` is load-bearing: Places TEXT search treats the radius as a *bias*, not a fence —
 * the first real Laguna Beach sweep (5 km) led with House of Blues Anaheim (~40 km away) and The
 * Observatory in Santa Ana. A venue with coordinates outside 1.25× the radius is dropped; one
 * with no coordinates is kept (we cannot prove it is far).
 */
export function mergeVenues(
  textHits: TextNearbyBusiness[],
  typeHits: NearbyBusiness[],
  fallback: { city: string | null; region: string | null },
  cap = VENUE_CAP,
  within?: { lat: number; lon: number; radiusMeters: number },
): Venue[] {
  const inRange = (b: NearbyBusiness) => {
    if (!within || b.lat == null || b.lon == null) return true;
    return haversineMeters(within.lat, within.lon, b.lat, b.lon) <= within.radiusMeters * 1.25;
  };
  const byId = new Map<string, Venue>();
  const toVenue = (b: NearbyBusiness, signal: VenueSignal): Venue => {
    const parsed = parseCityRegion(b.address);
    return {
      place_id: b.placeId,
      name: b.name,
      address: b.address ?? null,
      city: parsed.city ?? fallback.city,
      region: parsed.region ?? fallback.region,
      lat: b.lat ?? null,
      lon: b.lon ?? null,
      website: b.website ?? null,
      phone: b.phone ?? null,
      rating: typeof b.rating === 'number' ? b.rating : null,
      review_count: typeof b.reviewCount === 'number' ? b.reviewCount : null,
      types: Array.isArray(b.types) ? b.types : [],
      signal,
    };
  };
  for (const b of textHits) if (b?.placeId && !byId.has(b.placeId) && inRange(b)) byId.set(b.placeId, toVenue(b, 'text'));
  for (const b of typeHits) {
    if (!b?.placeId || byId.has(b.placeId) || !inRange(b)) continue;
    byId.set(b.placeId, toVenue(b, NAME_RE.test(b.name || '') ? 'name' : 'type'));
  }
  return Array.from(byId.values())
    .sort((a, b) => {
      const ar = a.review_count ?? -1;
      const br = b.review_count ?? -1;
      return br - ar || a.name.localeCompare(b.name);
    })
    .slice(0, cap);
}

export type VenueSweepDeps = {
  geocode: (city: string, region?: string) => Promise<{ lat: number; lon: number } | null>;
  text: (args: { lat: number; lon: number; radiusMeters: number; textQueries: string[] }) => Promise<TextNearbyBusiness[]>;
  nearby: (args: { lat: number; lon: number; radiusMeters: number; includedTypes: string[] }) => Promise<NearbyBusiness[]>;
};

export const defaultVenueSweepDeps: VenueSweepDeps = {
  geocode: (city, region) => getLatLonForCityState(city, region),
  text: (a) => searchTextNearby({ ...a, maxPerQuery: 20 }),
  nearby: (a) => searchNearby({ ...a, maxPerType: 20 }),
};

/** Validate + resolve the centre, run both searches, merge. Throws VenueSweepError. */
export async function runVenueSweep(input: VenueSweepInput, deps: VenueSweepDeps = defaultVenueSweepDeps): Promise<VenueSweepResult> {
  const city = String(input.city ?? '').trim().slice(0, 80);
  const region = String(input.region ?? '').trim().slice(0, 40) || undefined;
  const kinds = Array.isArray(input.kinds) && input.kinds.length ? input.kinds.map(String) : ['live_music'];
  const unknown = kinds.filter((k) => !(VENUE_KINDS as readonly string[]).includes(k));
  if (unknown.length) throw new VenueSweepError(400, 'bad_kind', `Unknown kind(s): ${unknown.join(', ')}. Known: ${VENUE_KINDS.join(', ')}.`);

  let lat = typeof input.lat === 'number' && Number.isFinite(input.lat) ? input.lat : NaN;
  let lon = typeof input.lon === 'number' && Number.isFinite(input.lon) ? input.lon : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    if (!city) throw new VenueSweepError(400, 'bad_body', 'Provide a city (and optionally region) or lat + lon.');
    const geo = await deps.geocode(city, region);
    if (!geo) throw new VenueSweepError(422, 'not_geocodable', `Couldn’t locate “${city}${region ? `, ${region}` : ''}”.`);
    lat = geo.lat;
    lon = geo.lon;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new VenueSweepError(400, 'bad_body', 'lat/lon out of range.');
  const radiusMeters = clampRadius(input.radiusMeters);

  let textHits: TextNearbyBusiness[] = [];
  let typeHits: NearbyBusiness[] = [];
  try {
    [textHits, typeHits] = await Promise.all([
      deps.text({ lat, lon, radiusMeters, textQueries: [...VENUE_TEXT_QUERIES] }),
      deps.nearby({ lat, lon, radiusMeters, includedTypes: [...VENUE_TYPES] }),
    ]);
  } catch (e: any) {
    if (e instanceof PlacesError) {
      if (e.code === 'not_configured') throw new VenueSweepError(501, 'not_configured', 'Venue sweep is not configured on this host.');
      if (e.code === 'invalid') throw new VenueSweepError(400, 'bad_body', e.message);
      throw new VenueSweepError(502, 'places_failed', e.message);
    }
    throw e;
  }

  const label = city ? `${city}${region ? `, ${region}` : ''}` : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  return {
    ok: true,
    center: { lat, lon, label },
    venues: mergeVenues(textHits, typeHits, { city: city || null, region: region ?? null }, VENUE_CAP, { lat, lon, radiusMeters }),
    note: VENUE_NOTE,
  };
}
