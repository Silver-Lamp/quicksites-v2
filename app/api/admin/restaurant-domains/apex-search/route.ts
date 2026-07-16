// app/api/admin/restaurant-domains/apex-search/route.ts
//
// Apex-domain search for the restaurant land-grab: is <city>-restaurant.com already
// running a contest, sitting in our owned-domains ledger, or available to buy (with
// price)? Called by the prospects sweep (auto-check right after a city is swept) and
// the Location Domains area cards. Read-only — buying goes through buy-apex.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { searchRestaurantApex } from '@/lib/outreach/apexDomainSearch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  if (!city) return NextResponse.json({ error: 'city is required.' }, { status: 400 });

  const result = await searchRestaurantApex({
    city,
    region: typeof body.region === 'string' ? body.region : null,
    domain: typeof body.domain === 'string' ? body.domain : null,
  });
  return NextResponse.json({ ok: true, result });
}
