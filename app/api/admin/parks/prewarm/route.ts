// app/api/admin/parks/prewarm/route.ts
//
// Manually pre-warm the industrial-park registry for a metro and return the parks so an
// operator can eyeball Places data quality BEFORE the lazy resolver feeds them onto live
// pitch sites. CHEAP — a handful of Places Text Search calls, NO AI spend.
//
// POST { city, region? }
//   → { area, swept, count, parks: [{ name, street, city, region, postalCode, uses, sampleSuite }] }
//
// GET  ?city=Renton&region=WA   → same, read-only preview of what's already stored (no sweep)
//
// Gated by PARKS_REGISTRY_ENABLED (ensureParksForArea is a no-op when off) + admin auth.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { ensureParksForArea } from '@/lib/parks/seedParks';
import { getParksForArea, hasAreaBeenSwept, parksRegistryEnabled, areaKey } from '@/lib/parks/registry';
import { pickSuite } from '@/lib/parks/suiteScheme';
import { cleanCityName } from '@/lib/geo/cleanCityName';
import type { Park } from '@/lib/parks/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // several Places Text Search calls

/** Flatten a stored park into a reviewable preview row (with one sample synthetic suite). */
function preview(p: Park) {
  return {
    placeId: p.place_id,
    name: p.name,
    street: p.street,
    city: p.city,
    region: p.region,
    postalCode: p.postal_code,
    uses: p.permitted_uses,
    scheme: p.suite_scheme,
    // Illustrative unit for a hypothetical site — shows what a resolved address would carry.
    sampleSuite: pickSuite(p.suite_scheme, `${p.place_id}.example.com`),
  };
}

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!parksRegistryEnabled()) {
    return NextResponse.json({ error: 'Registry disabled — set PARKS_REGISTRY_ENABLED=1.' }, { status: 400 });
  }

  const limited = await rateLimitOr429(req, 'parks-prewarm', 30, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const city = cleanCityName(typeof body.city === 'string' ? body.city : '');
  const region = typeof body.region === 'string' ? body.region.trim() : '';
  if (!city) return NextResponse.json({ error: 'A city is required.' }, { status: 400 });

  const already = await hasAreaBeenSwept(city, region);
  let parks: Park[];
  try {
    parks = await ensureParksForArea(city, region, operator.id ?? null);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sweep failed.' }, { status: 502 });
  }

  return NextResponse.json({
    area: areaKey(city, region),
    swept: !already, // true when THIS call did the Places sweep
    count: parks.length,
    parks: parks.map(preview),
  });
}

export async function GET(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const city = cleanCityName(url.searchParams.get('city') ?? '');
  const region = (url.searchParams.get('region') ?? '').trim();
  if (!city) return NextResponse.json({ error: 'A city is required.' }, { status: 400 });

  const swept = await hasAreaBeenSwept(city, region);
  const parks = await getParksForArea(city, region);
  return NextResponse.json({
    area: areaKey(city, region),
    swept,
    count: parks.length,
    parks: parks.map(preview),
  });
}
