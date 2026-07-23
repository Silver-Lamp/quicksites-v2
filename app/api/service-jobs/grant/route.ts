// app/api/service-jobs/grant/route.ts
// Save the shop's HJ capture-grant token (the owner granted QS read on HJ's side and pasted
// the token here). Owner-gated. GET reports whether one is on file.
//   GET  -> { hasGrant }
//   POST -> { grantToken } -> { ok }

import { NextResponse } from 'next/server';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { requireUser } from '@/lib/auth/requireUser';
import { getCaptureGrant, setCaptureGrant } from '@/lib/serviceJobs/captureGrants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const grant = await getCaptureGrant(gate.user.id);
  return NextResponse.json({ ok: true, hasGrant: !!grant });
}

export async function POST(req: Request) {
  if (!SECONDSET_ENABLED) return NextResponse.json({ error: 'not_enabled' }, { status: 404 });
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const grantToken = typeof body.grantToken === 'string' ? body.grantToken.trim() : '';
  if (!grantToken) return NextResponse.json({ error: 'missing_grant' }, { status: 400 });
  try {
    await setCaptureGrant(gate.user.id, grantToken);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'save_failed' }, { status: 500 });
  }
}
