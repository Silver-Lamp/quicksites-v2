// app/api/admin/restaurant-domains/convert/route.ts
//
// Convert a legacy rent-model (geo_services) restaurant campaign — e.g. a
// <city>-restaurant.com launched from the services competition cards — into a
// first-claim-wins restaurant contest. Admin-gated; guards (not rented/claimed,
// 2+ built cohort, pitch site parked off the apex slug) live in
// lib/outreach/restaurantDomains.ts#convertToRestaurantCompetition.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { convertToRestaurantCompetition } from '@/lib/outreach/restaurantDomains';

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
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 });

  try {
    const r = await convertToRestaurantCompetition(campaignId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not convert.' }, { status: 400 });
  }
}
