// app/api/admin/prospects/no-ordering/route.ts
//
// GET ?city=&region= → the city's restaurants grouped by ordering platform; no city → the list
// of cities that have swept restaurants. Admin-only, read-only. The page at
// /admin/restaurants/no-ordering is the only caller.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { listRestaurantsByOrdering, restaurantCities } from '@/lib/prospects/noOrderingList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const url = new URL(req.url);
  const city = (url.searchParams.get('city') ?? '').trim();
  const region = (url.searchParams.get('region') ?? '').trim() || null;
  if (!city) return NextResponse.json({ ok: true, cities: await restaurantCities() });
  const r = await listRestaurantsByOrdering({ city, region });
  return NextResponse.json({ ok: true, city, region, ...r });
}
