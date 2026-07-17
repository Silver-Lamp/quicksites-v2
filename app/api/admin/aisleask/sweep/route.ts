// app/api/admin/aisleask/sweep/route.ts
//
// AisleAsk location-planning sweep: given a city (or lat/lon) + selected store categories,
// return catalogable stores WITH coords — the candidate set the operator turns into gigs.
// Distinct from the prospecting sweep (/api/admin/prospects/discover): no prospect parking,
// no website-freshness scoring, no AI. Just "what aisle-organized stores are here, and where."
// See docs/AISLEASK_OPS_PLAN.md Feature A.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { searchNearby, PlacesError, type NearbyBusiness } from '@/lib/places/searchNearby';
import { searchTextNearby } from '@/lib/places/searchTextNearby';
import { getLatLonForCityState } from '@/lib/utils/geocode';
import { placesTypesFor, textQueriesFor } from '@/lib/aisleask/storeCategories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'aisleask-sweep', 30, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  let lat = Number(body.lat);
  let lon = Number(body.lon);
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const region = typeof body.region === 'string' ? body.region.trim() : '';
  const radiusMeters = Math.min(50_000, Math.max(500, Number(body.radiusMeters) || 5000));
  const categoryKeys: string[] = Array.isArray(body.categoryKeys)
    ? body.categoryKeys.map(String)
    : [];

  const includedTypes = placesTypesFor(categoryKeys);
  const textQueries = textQueriesFor(categoryKeys);
  if (!includedTypes.length && !textQueries.length) {
    return NextResponse.json({ error: 'Pick at least one store category.' }, { status: 400 });
  }

  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && city) {
    const geo = await getLatLonForCityState(city, region || undefined);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: 'Provide a city (or a valid lat/lon) to sweep.' },
      { status: 400 }
    );
  }

  let stores: NearbyBusiness[];
  try {
    const [byType, byText] = await Promise.all([
      includedTypes.length
        ? searchNearby({ lat, lon, radiusMeters, includedTypes })
        : Promise.resolve([]),
      textQueries.length
        ? searchTextNearby({ lat, lon, radiusMeters, textQueries })
        : Promise.resolve([]),
    ]);
    const byPlaceId = new Map<string, NearbyBusiness>();
    for (const b of byType) if (!byPlaceId.has(b.placeId)) byPlaceId.set(b.placeId, b);
    for (const b of byText) if (!byPlaceId.has(b.placeId)) byPlaceId.set(b.placeId, b);
    stores = [...byPlaceId.values()];
  } catch (e) {
    if (e instanceof PlacesError) {
      const status = e.code === 'not_configured' ? 501 : e.code === 'invalid' ? 400 : 502;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });
  }

  // Shape into gig candidates. Every store keeps its placeId (→ external_ref for de-dupe) and
  // coords (Places returns them in-response — no geocoding needed for the route planner).
  const candidates = stores.map((s) => ({
    placeId: s.placeId,
    store_name: s.name,
    address: s.address,
    latitude: s.lat,
    longitude: s.lon,
    types: s.types,
    location_label: city ? [city, region].filter(Boolean).join(', ') : null,
  }));

  return NextResponse.json({ ok: true, count: candidates.length, candidates });
}
