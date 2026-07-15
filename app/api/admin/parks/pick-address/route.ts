// app/api/admin/parks/pick-address/route.ts
//
// Pick a real industrial/flex-park address (real building + synthetic suite) for a given
// city/state, lazily seeding the area from Google Places on first touch. Used by the
// Template Identity panel's "Use an industrial park address" tool to fill the NAP fields.
//
// POST { city, region?, industryKey?, seed? }
//   → { ok:true, address:{ line1, suite, city, region, postalCode, lat, lng, label, parkName } }
//   → { ok:false, reason:'disabled'|'no_city'|'no_parks' }
//
// `seed` (e.g. the template id, optionally with a nonce) makes the park/suite choice
// deterministic — pass a different seed to "pick another". Admin-gated, rate-limited.
// CHEAP — Places Text Search on first touch for a metro, cached thereafter; no AI.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { parksRegistryEnabled } from '@/lib/parks/registry';
import { resolveOfficeAddressFromRegistry } from '@/lib/parks/officeAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Places Text Search on first touch for a metro

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  if (!parksRegistryEnabled()) {
    return NextResponse.json({ ok: false, reason: 'disabled' });
  }

  const limited = await rateLimitOr429(req, 'parks-pick-address', 60, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const region = typeof body.region === 'string' ? body.region.trim() : '';
  const industryKey = typeof body.industryKey === 'string' ? body.industryKey.trim() : null;
  const seed = (typeof body.seed === 'string' && body.seed.trim()) || `identity:${operator.id ?? 'anon'}`;
  if (!city) return NextResponse.json({ ok: false, reason: 'no_city' });

  let address;
  try {
    address = await resolveOfficeAddressFromRegistry(
      { domain: seed, city, region: region || null, industryKey },
      operator.id ?? null,
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Lookup failed.' }, { status: 502 });
  }

  if (!address) return NextResponse.json({ ok: false, reason: 'no_parks' });
  return NextResponse.json({ ok: true, address });
}
