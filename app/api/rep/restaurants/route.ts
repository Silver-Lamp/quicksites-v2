// app/api/rep/restaurants/route.ts
//
// GET ?city=&region=&code= → a city's swept restaurants grouped by online ordering, as the rep
// table renders them. Read-only, public (name / phone / host / platform / rating are Google's own
// listing data and what the business's site links), per-IP throttled. No sweep happens here;
// POST /api/rep/sweep is the one that spends.
import { NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { loadRestaurantsFor } from '@/lib/rep/repRestaurants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = await rateLimitOr429(req, 'rep-restaurants', 60, 3600);
  if (limited) return limited;
  const u = new URL(req.url);
  const city = (u.searchParams.get('city') ?? '').trim().slice(0, 60);
  const region = (u.searchParams.get('region') ?? '').trim().toUpperCase().slice(0, 2);
  const code = u.searchParams.get('code');
  if (!city) return NextResponse.json({ error: 'city_required' }, { status: 400 });
  const r = await loadRestaurantsFor({ city, region: region || null, code: code && /^[a-z0-9-]{2,40}$/i.test(code) ? code : null, menuHost: process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null });
  return NextResponse.json({ ok: true, city, region: region || null, ...r });
}
