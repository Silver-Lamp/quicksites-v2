// app/api/admin/prospects/recent-locations/route.ts
//
// Per-operator "Businesses near me" recent-sweep memory. Admin-gated; stored in
// site_settings under a per-user key so recents follow the admin across devices.
//   GET  -> { ok, locations: RecentLocation[] }
//   POST -> { city, region?, radiusKm, categories? }  → adds/refreshes one sweep
//   POST -> { clear: true }                            → clears the list

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import {
  getRecentLocations,
  addRecentLocationForUser,
  clearRecentLocations,
} from '@/lib/prospects/recentLocationsStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, locations: await getRecentLocations(operator.id) });
}

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (body.clear) {
    await clearRecentLocations(operator.id);
    return NextResponse.json({ ok: true, locations: [] });
  }

  const city = String(body.city ?? '').trim();
  if (!city) return NextResponse.json({ error: 'city is required.' }, { status: 400 });

  const radiusKm = Number(body.radiusKm);
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c: unknown): c is string => typeof c === 'string')
    : [];

  const locations = await addRecentLocationForUser(operator.id, {
    city,
    region: String(body.region ?? '').trim(),
    radiusKm: Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 3,
    categories,
    usedAt: Date.now(),
  });
  return NextResponse.json({ ok: true, locations });
}
