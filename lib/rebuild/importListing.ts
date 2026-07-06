// lib/rebuild/importListing.ts
//
// The "no website" ingestion source: turn a business LISTING (Google Places / Yelp)
// into the same RebuildSpec the URL-conversion path produces, so a restaurant with
// only a listing + menu photos still assembles into a full site (assembleDraft).
//
// - buildSpecFromListing(): pure mapper (listing + extracted menu → RebuildSpec).
// - mapPlacesHours(): Google opening_hours.periods → our HoursDaySpec.
// - fetchGooglePlace(): live Place Details, gated behind GOOGLE_PLACES_API_KEY.
//
// Do NOT scrape Yelp/Google HTML directly (Cloudflare + ToS). Use the official APIs
// here, or accept a pasted listing JSON.

import type { RebuildSpec, ContactSpec, HoursDaySpec, MenuSectionSpec } from '@/lib/rebuild/inferSiteSpec';

export type Listing = {
  name: string;
  phone?: string;
  address?: string;
  website?: string | null;
  categories?: string[];
  hours?: HoursDaySpec[];
  photos?: string[]; // fetchable image URLs (hero + menu candidates)
};

export class ListingImportError extends Error {
  code: 'not_configured' | 'not_found' | 'fetch_failed' | 'invalid';
  constructor(code: ListingImportError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'ListingImportError';
  }
}

const DAY_BY_INDEX = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // Google: 0 = Sunday
const GENERIC_TYPES = new Set(['point_of_interest', 'establishment', 'food', 'store']);

/** Google `opening_hours.periods` → validated HoursDaySpec[] (one entry per open day). */
export function mapPlacesHours(periods: any): HoursDaySpec[] {
  if (!Array.isArray(periods)) return [];
  const out: HoursDaySpec[] = [];
  const seen = new Set<string>();
  for (const p of periods) {
    const dayIdx = Number(p?.open?.day);
    const day = DAY_BY_INDEX[dayIdx];
    if (!day || seen.has(day)) continue;
    const open = hhmm(p?.open?.time);
    const close = hhmm(p?.close?.time);
    if (!open || !close) continue;
    seen.add(day);
    out.push({ day, open, close });
  }
  return out;
}

function hhmm(t: unknown): string | undefined {
  const s = String(t ?? '');
  if (!/^\d{4}$/.test(s)) return undefined;
  return `${s.slice(0, 2)}:${s.slice(2)}`;
}

/** Titlecase Google `types` into human category labels (drop generic ones). */
export function mapTypes(types: unknown): string[] {
  if (!Array.isArray(types)) return [];
  return types
    .map((t) => String(t))
    .filter((t) => t && !GENERIC_TYPES.has(t))
    .map((t) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .slice(0, 5);
}

/** Map a listing (+ optional photo-extracted menu) into a full RebuildSpec. Pure. */
export function buildSpecFromListing(
  listing: Listing,
  menu?: { sections: MenuSectionSpec[] } | undefined,
): RebuildSpec {
  const name = (listing?.name ?? '').trim() || 'Restaurant';
  const cats = (listing.categories ?? []).filter(Boolean);
  const contact: ContactSpec = {};
  if (listing.phone) contact.phone = listing.phone;
  if (listing.address) contact.address = listing.address;

  return {
    businessName: name,
    industryKey: 'restaurant',
    industryLabel: 'Restaurant',
    headline: name,
    subheadline: cats.length
      ? `${cats.slice(0, 2).join(' · ')} — order online or stop by.`
      : 'Fresh food, made daily — order online or stop by.',
    about: `${name}${cats.length ? ` — ${cats[0].toLowerCase()}` : ''}. Order online for pickup, or come visit us.`,
    services: cats,
    faqs: [],
    menu: menu?.sections?.length ? menu : undefined,
    contact: Object.keys(contact).length ? contact : undefined,
    hours: listing.hours?.length ? listing.hours : undefined,
  };
}

/**
 * Resolve a free-text business query ("Hawkers Bar & Grill, Auburn WA") to a Google
 * Place ID, so batch import can work from names instead of hand-looked-up ids.
 * Gated behind GOOGLE_PLACES_API_KEY.
 */
export async function findPlace(query: string, fetchImpl: typeof fetch = fetch): Promise<{ placeId: string; name: string }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new ListingImportError('not_configured', 'GOOGLE_PLACES_API_KEY is not set.');
  const q = (query ?? '').trim();
  if (!q) throw new ListingImportError('invalid', 'A search query is required.');

  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(q)}&inputtype=textquery&fields=place_id,name&key=${key}`;
  let json: any;
  try {
    const res = await fetchImpl(url);
    json = await res.json();
  } catch (e: any) {
    throw new ListingImportError('fetch_failed', e?.message || 'Places search failed.');
  }
  const c = Array.isArray(json?.candidates) ? json.candidates[0] : null;
  if (!c?.place_id) throw new ListingImportError('not_found', `No place matched "${q}".`);
  return { placeId: String(c.place_id), name: String(c.name ?? q) };
}

/**
 * Fetch a Google Place's details into a Listing. Gated behind GOOGLE_PLACES_API_KEY
 * — throws ListingImportError('not_configured') until it's set, so the route can
 * fall back to a pasted listing JSON. `fetchImpl` is injectable for tests.
 */
export async function fetchGooglePlace(placeId: string, fetchImpl: typeof fetch = fetch): Promise<Listing> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new ListingImportError('not_configured', 'GOOGLE_PLACES_API_KEY is not set.');
  if (!placeId) throw new ListingImportError('invalid', 'A Google Place ID is required.');

  const fields = 'name,formatted_phone_number,formatted_address,opening_hours,website,types,photos';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${key}`;

  let json: any;
  try {
    const res = await fetchImpl(url);
    json = await res.json();
  } catch (e: any) {
    throw new ListingImportError('fetch_failed', e?.message || 'Places request failed.');
  }
  if (json?.status !== 'OK' || !json.result) {
    throw new ListingImportError('not_found', json?.error_message || json?.status || 'Place not found.');
  }
  const r = json.result;
  const photos = (Array.isArray(r.photos) ? r.photos : [])
    .slice(0, 6)
    .map((p: any) => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${p.photo_reference}&key=${key}`);

  return {
    name: r.name,
    phone: r.formatted_phone_number,
    address: r.formatted_address,
    website: r.website ?? null,
    categories: mapTypes(r.types),
    hours: mapPlacesHours(r.opening_hours?.periods),
    photos,
  };
}
