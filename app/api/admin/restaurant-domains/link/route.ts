// app/api/admin/restaurant-domains/link/route.ts
//
// "Add to contest": pull built, un-linked no-website restaurants into an EXISTING
// restaurant domain-competition (they join the cohort racing for the apex; their
// tracked claim links start attributing to the contest). Admin-gated; validation
// (restaurant_competition kind, built site, not already competing) lives in
// lib/outreach/restaurantDomains.ts#addProspectsToCompetition.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { addProspectsToCompetition } from '@/lib/outreach/restaurantDomains';

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
  const prospectIds: string[] = Array.isArray(body.prospectIds)
    ? body.prospectIds.map(String).filter(Boolean)
    : [];
  if (!campaignId || !prospectIds.length) {
    return NextResponse.json({ error: 'campaignId and prospectIds are required.' }, { status: 400 });
  }

  try {
    const linked = await addProspectsToCompetition(campaignId, prospectIds);
    return NextResponse.json({ ok: true, linked });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not add to the contest.' }, { status: 400 });
  }
}
