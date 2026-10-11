// app/api/rep/sweep/route.ts
//
// "Sweep where you are": a visitor to /for-sales (or a rep on their page) asks for the
// restaurants around them, and the database grows one city at a time. POST { lat, lon } or
// { city, region } → the city is resolved, swept for restaurants if nobody has in 7 days, and
// the grouped list comes back.
//
// ⚠️ THIS SPENDS GOOGLE PLACES MONEY ON A STRANGER'S CLICK, so it is bounded four ways:
//   1. per IP: 2 sweeps a day;  2. global: 25 sweeps a day across everyone;
//   3. a city swept in the last 7 days is NOT re-swept — the existing rows come back;
//   4. the shape is fixed server-side — restaurant/cafe/bar, 2.5 km, the operator as owner —
//      nothing in the body chooses a radius, a category or an owner.
// Reads are not gated the same way: GET /api/rep/restaurants lists a city without sweeping.
//
// ⚠️ Two refinements (owner, 2026-10-10). The caps are for STRANGERS: a signed-in platform
// admin is the person paying the Places bill, so neither cap applies to them. And a capped
// visitor whose city we have ALREADY swept is shown what we hold instead of a bare 429 — the
// cap guards spend, and showing existing rows spends nothing. That is why the per-IP check
// runs after the city is resolved, not before.
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { checkRateLimit } from '@/lib/rateLimit';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { runSweep, SweepInputError } from '@/lib/prospects/runSweep';
import { getCityStateForLatLon } from '@/lib/utils/geocode';
import { loadRestaurantsFor, sweptRecently } from '@/lib/rep/repRestaurants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const RADIUS_METERS = 2500;
const TYPES = ['restaurant', 'cafe', 'bar'];
export const SWEEPS_PER_IP_PER_DAY = 2;
export const SWEEPS_PER_DAY_GLOBAL = 25;

export async function POST(req: Request) {
  const admin = await getAdminUser().catch(() => null);
  const asOwner = !!admin;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const code = typeof body.code === 'string' && /^[a-z0-9-]{2,40}$/i.test(body.code) ? body.code : null;

  // 1. Where.
  let city = typeof body.city === 'string' ? body.city.trim().slice(0, 60) : '';
  let region = typeof body.region === 'string' ? body.region.trim().toUpperCase().slice(0, 2) : '';
  let lat = Number(body.lat);
  let lon = Number(body.lon);
  if ((!city || !region) && Number.isFinite(lat) && Number.isFinite(lon)) {
    const where = await getCityStateForLatLon(lat, lon);
    if (!where) return NextResponse.json({ error: 'could_not_place_you' }, { status: 422 });
    city = where.city;
    region = where.region;
  } else {
    lat = NaN;
    lon = NaN; // runSweep geocodes a typed city itself
  }
  if (!city || !/^[A-Z]{2}$/.test(region)) return NextResponse.json({ error: 'city_and_state_required' }, { status: 400 });

  // 2. Already swept lately? Show what we have; spend nothing.
  const menuHost = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null;
  const existing = await loadRestaurantsFor({ city, region, code, menuHost });
  if (sweptRecently(existing.sweptOn)) {
    return NextResponse.json({ ok: true, city, region, swept: false, reason: 'recent', asOwner, ...existing });
  }

  // 3. The caps — strangers only. A capped visitor still sees a city we have swept before.
  if (!asOwner) {
    const limited = await rateLimitOr429(req, 'rep-sweep', SWEEPS_PER_IP_PER_DAY, 86_400);
    if (limited) {
      if (existing.rows.length > 0) return NextResponse.json({ ok: true, city, region, swept: false, reason: 'ip_cap', asOwner, ...existing });
      return limited;
    }
    const global = await checkRateLimit('rep-sweep:global', SWEEPS_PER_DAY_GLOBAL, 86_400);
    if (!global.ok) return NextResponse.json({ ok: true, city, region, swept: false, reason: 'daily_cap', asOwner, ...existing }, { status: 200 });
  }

  // 4. The sweep itself.
  const operatorId = process.env.TRADE_PIPELINE_OPERATOR_ID || null;
  try {
    const r = await runSweep({
      lat: Number.isFinite(lat) ? lat : (undefined as any),
      lon: Number.isFinite(lon) ? lon : (undefined as any),
      city,
      region,
      radiusMeters: RADIUS_METERS,
      includedTypes: TYPES,
      textCategories: [],
      operatorId: operatorId ?? undefined,
    } as any);
    const after = await loadRestaurantsFor({ city, region, code, menuHost });
    return NextResponse.json({ ok: true, city, region, swept: true, asOwner, found: r.found, inserted: r.inserted, orderingChecked: r.orderingChecked, ...after });
  } catch (e: any) {
    if (e instanceof SweepInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    // A dead Places key reads as a 501 — say so rather than "no restaurants here".
    const code2 = e?.code === 'not_configured' ? 'places_unavailable' : 'sweep_failed';
    return NextResponse.json({ error: code2, detail: e?.message }, { status: code2 === 'places_unavailable' ? 501 : 502 });
  }
}
