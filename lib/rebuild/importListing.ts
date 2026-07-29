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

import type {
  RebuildSpec,
  ContactSpec,
  HoursDaySpec,
  MenuSectionSpec,
} from '@/lib/rebuild/inferSiteSpec';
import { parseUsAddress } from '@/lib/rebuild/parseAddress';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { typeToIndustryKey } from '@/lib/places/typeToIndustry';

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

/**
 * Humanize a single category label for user-facing copy: underscores → spaces, collapse
 * whitespace, sentence-case the first letter. Idempotent — a label that's already nice
 * ("Bars", "American (Traditional)") passes through unchanged, so it's safe to apply even
 * when the source already ran mapTypes. Guards against raw Places types ("bar_and_grill")
 * leaking into headlines/services on any import path.
 */
export function prettyCategory(cat: string): string {
  const t = String(cat ?? '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Map a listing (+ optional photo-extracted menu) into a full RebuildSpec. Pure.
 *
 * `industryKey` is derived from the listing categories (Google Places types) so a
 * non-restaurant business gets the right starter scaffold; pass an explicit override
 * to force one. Defaults to 'restaurant' when categories don't resolve (the pipeline's
 * historical default), and restaurant copy is only used for the restaurant key.
 */
export function buildSpecFromListing(
  listing: Listing,
  menu?: { sections: MenuSectionSpec[] } | undefined,
  industryOverride?: IndustryKey
): RebuildSpec {
  const cats = (listing.categories ?? []).filter(Boolean);
  const industryKey = industryOverride ?? typeToIndustryKey(cats);
  const industryLabel = KEY_TO_LABEL[industryKey] ?? 'Business';
  const isRestaurant = industryKey === 'restaurant';
  const name = (listing?.name ?? '').trim() || (isRestaurant ? 'Restaurant' : industryLabel);

  // Categories can arrive as raw Places types ("bar_and_grill") depending on the source
  // path. Humanize them for anything user-facing (idempotent — already-nice labels like
  // "Bars" pass through unchanged) so no snake_case ever leaks into copy or services. Keep
  // the RAW `cats` for typeToIndustryKey above, which matches on the raw Places type ids.
  const displayCats = cats.map(prettyCategory);

  const contact: ContactSpec = {};
  if (listing.phone) contact.phone = listing.phone;
  if (listing.address) {
    // Split the formatted listing address so city/state/postal land in the structured
    // location + footer fields (was: the whole string dumped into `address`).
    const parsed = parseUsAddress(listing.address);
    contact.address = parsed.address;
    if (parsed.city) contact.city = parsed.city;
    if (parsed.state) contact.state = parsed.state;
    if (parsed.postal) contact.postal = parsed.postal;
  }

  const catLead = displayCats.length ? displayCats.slice(0, 2).join(' · ') : industryLabel;
  const subheadline = isRestaurant
    ? displayCats.length
      ? `${displayCats.slice(0, 2).join(' · ')} — order online or stop by.`
      : 'Fresh food, made daily — order online or stop by.'
    : `${catLead} — call or stop by today.`;
  const about = isRestaurant
    ? `${name}${displayCats.length ? ` — ${displayCats[0].toLowerCase()}` : ''}. Order online for pickup, or come visit us.`
    : `${name}${displayCats.length ? ` — ${displayCats[0].toLowerCase()}` : ` — ${industryLabel.toLowerCase()}`}. Get in touch to learn more.`;

  return {
    businessName: name,
    industryKey,
    industryLabel,
    headline: name,
    subheadline,
    about,
    services: displayCats,
    faqs: [],
    // Menu only rides food specs; a non-restaurant listing never carries one.
    menu: isRestaurant && menu?.sections?.length ? menu : undefined,
    contact: Object.keys(contact).length ? contact : undefined,
    hours: listing.hours?.length ? listing.hours : undefined,
  };
}

/**
 * Resolve a free-text business query ("Hawkers Bar & Grill, Auburn WA") to a Google
 * Place ID, so batch import can work from names instead of hand-looked-up ids.
 * Gated behind GOOGLE_PLACES_API_KEY.
 */
export async function findPlace(
  query: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ placeId: string; name: string }> {
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
export async function fetchGooglePlace(
  placeId: string,
  fetchImpl: typeof fetch = fetch
): Promise<Listing> {
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
    throw new ListingImportError(
      'not_found',
      json?.error_message || json?.status || 'Place not found.'
    );
  }
  const r = json.result;
  // ⚠️ These stay KEYED on purpose, and must never be persisted.
  //
  // They are consumed in-process by the menu OCR path (`pickMenuPhotos` → OpenAI vision),
  // which hands the URL to OpenAI to fetch from THEIR servers. A relative or proxied URL is
  // unfetchable there, so keyless-at-source would silently kill menu extraction while every
  // import still "succeeded".
  //
  // The key leaked because these strings reached `templates.data`. The fix is therefore at
  // the STORAGE boundary, not here: `sanitizePersistedPhotoUrl` in lib/places/photoProxy.ts
  // rewrites them to the keyless proxy form on the way into a draft. Anything writing one of
  // these into a template must go through it.
  const photos = (Array.isArray(r.photos) ? r.photos : [])
    .slice(0, 10) // more candidates so the menu-photo classifier has options
    .map(
      (p: any) =>
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${p.photo_reference}&key=${key}`
    );

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
