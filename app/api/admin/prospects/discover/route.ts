// app/api/admin/prospects/discover/route.ts
//
// The geographic fan-out: sweep businesses near a point, filter by website presence /
// freshness into lead tiers, and park them as prospects. CHEAP — Places calls + a
// best-effort site fetch per business with a website; NO AI spend. The operator then
// selectively builds draft sites from the prospect list (/api/admin/prospects/build).
//
// The work lives in lib/prospects/runSweep.ts so the nightly trade-site pipeline runs exactly
// what this button runs. This route is validation + rate limit + HTTP mapping.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { PlacesError } from '@/lib/places/searchNearby';
import { runSweep, SweepInputError } from '@/lib/prospects/runSweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // a sweep can fetch many prospect sites to score

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'prospects-discover', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const includedTypes: string[] = Array.isArray(body.includedTypes) ? body.includedTypes.map(String).filter(Boolean) : [];
  // Keyword categories (towing, HVAC, landscaping, …) have no Places type, so they come through
  // as free-text queries. Each carries the industry key it represents.
  const textCategories: { query: string; industry?: string }[] = Array.isArray(body.textCategories)
    ? body.textCategories
        .map((c: any) => ({ query: String(c?.query ?? '').trim(), industry: c?.industry ? String(c.industry) : undefined }))
        .filter((c: any) => c.query)
    : [];

  try {
    const r = await runSweep({
      lat: Number(body.lat),
      lon: Number(body.lon),
      city: typeof body.city === 'string' ? body.city : '',
      region: typeof body.region === 'string' ? body.region : '',
      radiusMeters: Number(body.radiusMeters) || 1500,
      includedTypes,
      textCategories,
      sweepId: typeof body.sweepId === 'string' && body.sweepId ? body.sweepId : undefined,
      operatorId: operator.id,
    });
    return NextResponse.json({ ok: true, sweepId: r.sweepId, inserted: r.inserted, found: r.found, tallies: r.tallies, signals: r.signals });
  } catch (e) {
    if (e instanceof SweepInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof PlacesError) {
      const status = e.code === 'not_configured' ? 501 : e.code === 'invalid' ? 400 : 502;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });
  }
}
