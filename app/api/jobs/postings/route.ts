// app/api/jobs/postings/route.ts
//
// The saved-postings API for the Verbatim job-seeker workspace.
//
// ⚠️ EVERY HANDLER USES THE CALLER'S OWN SUPABASE SESSION, NEVER THE SERVICE ROLE. This repo's
// norm is service-role + route-level authorization (CLAUDE.md §6), which is right for a menu and
// wrong for a private job search: it would make every query *capable* of reading anyone's list,
// with a correct `.eq('owner_id', …)` as the only thing between. Here RLS is the guarantee, so a
// forgotten filter returns nothing rather than everything — and there is no admin path at all,
// because no QuickSites employee has a reason to know who someone is applying to.

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/requireUser';
import { createPosting, deletePosting, listPostings, updatePosting } from '@/lib/jobs/postings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const db = await getServerSupabase();
  return NextResponse.json({ postings: await listPostings(db) });
}

export async function POST(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const body = await req.json().catch(() => ({}));
  const db = await getServerSupabase();
  const { posting, error } = await createPosting(db, gate.user.id, body ?? {});
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ posting });
}

export async function PATCH(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const db = await getServerSupabase();
  // No ownership check here on purpose: RLS scopes the UPDATE, so someone else's id simply
  // matches no row. A hand-rolled check would be a second, driftable copy of that rule.
  const err = await updatePosting(db, id, body ?? {});
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const db = await getServerSupabase();
  const err = await deletePosting(db, id);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ ok: true });
}
