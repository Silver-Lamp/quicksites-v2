// app/api/tools/venue-sweep/route.ts
//
// POST /api/tools/venue-sweep — live-music venues near a city, from our Places seam.
// Contract: crosstalk/contracts/venue-sweep.md (single source of truth; consumer = HiveJournal's
// Cornerstone Display "Live music" panel). Logic in lib/venues/venueSweep.ts; this is the thin route.
//
// Access: public + per-IP rate-limited like /api/tools/route-optimize, UNLESS `QS_TOOLS_TOKEN` is
// set — then a matching `Authorization: Bearer` is required (HJ sends it when configured). Same
// status conventions as route-optimize: 400 bad body · 422 not geocodable · 429 rate-limited ·
// 501 not_configured (no GOOGLE_PLACES_API_KEY) · 502 Places failed.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { runVenueSweep, VenueSweepError } from '@/lib/venues/venueSweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function tokenOk(req: NextRequest): boolean {
  const want = process.env.QS_TOOLS_TOKEN;
  if (!want) return true; // public
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!got || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) return NextResponse.json({ error: 'Unauthorized.', code: 'unauthorized' }, { status: 401 });

  const limited = await rateLimitOr429(req, 'venue-sweep', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.', code: 'bad_body' }, { status: 400 });
  }

  try {
    const result = await runVenueSweep({
      city: typeof body?.city === 'string' ? body.city : undefined,
      region: typeof body?.region === 'string' ? body.region : undefined,
      lat: typeof body?.lat === 'number' ? body.lat : typeof body?.lat === 'string' ? Number(body.lat) : undefined,
      lon: typeof body?.lon === 'number' ? body.lon : typeof body?.lon === 'string' ? Number(body.lon) : undefined,
      radiusMeters: body?.radiusMeters,
      kinds: Array.isArray(body?.kinds) ? body.kinds : undefined,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e instanceof VenueSweepError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error('[venue-sweep] failed', e);
    return NextResponse.json({ error: 'Venue sweep failed.', code: 'internal' }, { status: 500 });
  }
}
