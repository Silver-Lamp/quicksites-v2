// app/api/admin/aisleask/gigs/[id]/route.ts
//
// Operator management of one gig: close it (→ completed, clears any claim), reopen it (→ open,
// back in the pool), or edit its notes / location label. Distinct from the tasker actions in
// /api/walker/gigs/[id] (which are scoped to the gig's holder). Admin-gated.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { adminUpdateGig } from '@/lib/walker/gigs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing gig id.' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const status = body?.status === 'open' || body?.status === 'completed' ? body.status : undefined;
  const gig = await adminUpdateGig(id, {
    status,
    notes: typeof body?.notes === 'string' ? body.notes : undefined,
    location_label: typeof body?.location_label === 'string' ? body.location_label : undefined,
  });
  if (!gig) return NextResponse.json({ error: 'Gig not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, gig });
}
