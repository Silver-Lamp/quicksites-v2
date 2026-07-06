// lib/rebuild/importListingYelp.ts
//
// Yelp Fusion as a SECOND photo/data source for listing import. Yelp's top photos
// skew toward menu shots more than Google's, so pulling them widens the candidate
// pool for the menu-photo classifier — more listings get a real menu without the
// operator hand-supplying one. Best-effort: gated behind YELP_API_KEY, and every
// failure returns the listing unchanged so it never blocks assembly.
//
// Yelp Fusion does NOT expose a structured menu (that endpoint was retired) — only
// photos + basic facts. No HTML scraping.

import type { Listing } from '@/lib/rebuild/importListing';
import type { HoursDaySpec } from '@/lib/rebuild/inferSiteSpec';

const YELP_BASE = 'https://api.yelp.com/v3';
const YELP_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']; // Yelp: 0 = Monday

function hhmm(t: unknown): string | undefined {
  const s = String(t ?? '');
  if (!/^\d{4}$/.test(s)) return undefined;
  return `${s.slice(0, 2)}:${s.slice(2)}`;
}

/** Yelp `hours[0].open` → validated HoursDaySpec[] (one entry per day; day 0 = Monday). */
export function mapYelpHours(open: any): HoursDaySpec[] {
  if (!Array.isArray(open)) return [];
  const out: HoursDaySpec[] = [];
  const seen = new Set<string>();
  for (const p of open) {
    const day = YELP_DAY[Number(p?.day)];
    if (!day || seen.has(day)) continue;
    const o = hhmm(p?.start);
    const c = hhmm(p?.end);
    if (!o || !c) continue;
    seen.add(day);
    out.push({ day, open: o, close: c });
  }
  return out;
}

/** Map a Yelp business-details payload → our Listing shape. Pure (exported for tests). */
export function yelpBusinessToListing(b: any): Listing {
  const address = Array.isArray(b?.location?.display_address) ? b.location.display_address.join(', ') : undefined;
  return {
    name: String(b?.name ?? ''),
    phone: b?.display_phone || undefined,
    address: address || undefined,
    website: null, // Yelp gives its own page URL, not the business's site
    categories: Array.isArray(b?.categories) ? b.categories.map((c: any) => String(c?.title)).filter(Boolean) : [],
    hours: mapYelpHours(b?.hours?.[0]?.open),
    photos: Array.isArray(b?.photos) ? b.photos.filter((u: any) => typeof u === 'string') : [],
  };
}

async function yelpGet(path: string, fetchImpl: typeof fetch): Promise<any> {
  const res = await fetchImpl(`${YELP_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}`, accept: 'application/json' },
  });
  return res.json();
}

/**
 * Find a business on Yelp by name + location and return its details as a Listing.
 * Returns null (never throws) when unavailable, so callers can treat it as optional.
 */
export async function fetchYelpBusiness(term: string, location: string, fetchImpl: typeof fetch = fetch): Promise<Listing | null> {
  if (!process.env.YELP_API_KEY || !term?.trim() || !location?.trim()) return null;
  try {
    const search = await yelpGet(
      `/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=1`,
      fetchImpl,
    );
    const id = search?.businesses?.[0]?.id;
    if (!id) return null;
    const details = await yelpGet(`/businesses/${encodeURIComponent(id)}`, fetchImpl);
    if (!details?.name) return null;
    return yelpBusinessToListing(details);
  } catch {
    return null;
  }
}

/**
 * Augment a (Google) listing with Yelp data: merge in Yelp's photos as extra
 * menu-photo candidates, and fill any missing hours/phone. Returns a new listing;
 * unchanged when Yelp is unconfigured or finds nothing. Best-effort.
 */
export async function augmentListingWithYelp(listing: Listing, fetchImpl: typeof fetch = fetch): Promise<Listing> {
  if (!process.env.YELP_API_KEY || !listing?.name) return listing;
  const location = listing.address || (listing.categories?.length ? '' : '');
  if (!location) return listing; // need a location to search Yelp reliably

  const yelp = await fetchYelpBusiness(listing.name, location, fetchImpl);
  if (!yelp) return listing;

  const photos = Array.from(new Set([...(listing.photos ?? []), ...(yelp.photos ?? [])])).slice(0, 14);
  return {
    ...listing,
    photos,
    hours: listing.hours?.length ? listing.hours : yelp.hours,
    phone: listing.phone || yelp.phone,
  };
}
