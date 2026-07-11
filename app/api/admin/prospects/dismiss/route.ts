// app/api/admin/prospects/dismiss/route.ts
//
// Hide a prospect from the working list (not a lead we want to pursue).

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { dismissProspect } from '@/lib/outreach/prospects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'A prospect id is required.' }, { status: 400 });

  await dismissProspect(id);
  return NextResponse.json({ ok: true });
}
