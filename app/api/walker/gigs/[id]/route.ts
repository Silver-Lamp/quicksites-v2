// app/api/walker/gigs/[id]/route.ts
//
// Tasker actions on one gig: claim (from the open pool), complete (after cataloging), or
// release (put it back). Authed tasker; the data layer scopes every mutation to this user
// and the right prior status, so claims are race-safe and you can only complete/release
// what you hold.

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { claimGig, completeGig, releaseGig } from '@/lib/walker/gigs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing gig id.' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* action may come with no body */
  }
  const action = typeof body?.action === 'string' ? body.action : '';
  const userId = auth.user.id;

  if (action === 'claim') {
    const gig = await claimGig(id, userId);
    if (!gig) return NextResponse.json({ error: 'That gig was just taken.', code: 'already_claimed' }, { status: 409 });
    return NextResponse.json({ gig });
  }
  if (action === 'complete') {
    const ok = await completeGig(id, userId);
    if (!ok) return NextResponse.json({ error: 'Not your gig to complete.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'release') {
    const ok = await releaseGig(id, userId);
    if (!ok) return NextResponse.json({ error: 'Not your gig to release.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
