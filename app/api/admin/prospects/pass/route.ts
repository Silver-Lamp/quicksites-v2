// app/api/admin/prospects/pass/route.ts
//
// Mark a competing business out of the running for its geo-domain contest ('passed'),
// or restore it (undo). Distinct from dismiss (which hides the prospect entirely).

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { setWaitlistStatus } from '@/lib/outreach/prospects';

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
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'A prospect id is required.' }, { status: 400 });

  await setWaitlistStatus(id, body.undo ? null : 'passed');
  return NextResponse.json({ ok: true });
}
