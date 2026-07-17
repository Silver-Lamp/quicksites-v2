// app/api/walker/gigs/route.ts
//
// The store-walk gig board API. GET returns the open pool + the caller's claimed walk
// (authed tasker). POST creates a gig (admin/operator seeds them — from the AisleAsk store
// list or by hand). Deny-default RLS table, so everything goes through the service role
// behind these authed routes. v0: no payments (§10 wedge).

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/auth/requireUser';
import { listOpenGigs, listMyGigs, createGig, planRouteUrl } from '@/lib/walker/gigs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const [open, mine] = await Promise.all([listOpenGigs(), listMyGigs(auth.user.id)]);
  // One-tap "plan my route" over the still-to-do (claimed, not completed) stops.
  const plan_url = planRouteUrl(mine.filter((g) => g.status === 'claimed'));
  return NextResponse.json({ open, mine, plan_url });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const store_name = typeof body?.store_name === 'string' ? body.store_name.trim() : '';
  if (!store_name) return NextResponse.json({ error: 'store_name is required.' }, { status: 400 });

  const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
  const gig = await createGig({
    store_name,
    address: typeof body?.address === 'string' ? body.address : undefined,
    latitude: num(body?.latitude),
    longitude: num(body?.longitude),
    location_label: typeof body?.location_label === 'string' ? body.location_label : undefined,
    source: typeof body?.source === 'string' ? body.source : 'manual',
    external_ref: typeof body?.external_ref === 'string' ? body.external_ref : undefined,
    notes: typeof body?.notes === 'string' ? body.notes : undefined,
  });
  if (!gig) return NextResponse.json({ error: 'Could not create gig.' }, { status: 500 });
  return NextResponse.json({ gig }, { status: 201 });
}
