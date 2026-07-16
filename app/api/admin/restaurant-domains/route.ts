// app/api/admin/restaurant-domains/route.ts
//
// The "Restaurant Location Domains" overview: every restaurant apex we own or could
// launch, the contest running on it, its competing cohort, and the no-website
// restaurants in the area still available to pull into the claim-contest funnel.
// Admin-gated; thin wrapper over lib/outreach/restaurantDomains.ts.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { getRestaurantLocationDomains } from '@/lib/outreach/restaurantDomains';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const overview = await getRestaurantLocationDomains();
    return NextResponse.json(overview);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
