// app/api/admin/talking-demo/ensure/route.ts
//
// Trigger the idempotent, flag-gated Talking Demo auto-generation for a site (the outreach path:
// ensure a reel exists → get the watch URL + QR to drop on a postcard). Thin wrapper over
// lib/talkingDemo/ensureTalkingDemo. Admin-gated; returns null-ish when disabled/not configured.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { ensureTalkingDemo, talkingDemoAutogenEnabled } from '@/lib/talkingDemo/ensureTalkingDemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const ref = (typeof body.templateId === 'string' && body.templateId.trim())
    || (typeof body.id === 'string' && body.id.trim())
    || (typeof body.slug === 'string' && body.slug.trim())
    || '';
  if (!ref) return NextResponse.json({ error: 'templateId or slug is required' }, { status: 400 });

  const result = await ensureTalkingDemo(ref, { force: body.force === true, actorId: gate.user.id });
  if (!result) {
    return NextResponse.json({
      ok: false,
      enabled: talkingDemoAutogenEnabled(),
      reason: talkingDemoAutogenEnabled() ? 'not configured or render failed' : 'auto-gen disabled (set TALKING_DEMO_AUTOGEN_ENABLED=1)',
    });
  }
  return NextResponse.json({ ok: true, ...result });
}
