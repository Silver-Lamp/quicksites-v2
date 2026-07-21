// app/api/admin/talking-demo/[instanceId]/route.ts
//
// Talking Demo Tier 2 — MP4 poll passthrough. After POST /render with want_mp4:true, HJ returns
// mp4_status:'rendering'; poll here until 'ready' (mp4_url + poster_url) or 'failed'
// (crosstalk/contracts/talking-demo-render.md). Server-to-server on the partner-provisioning rails,
// so the shared secret stays server-side.
//
// Admin-gated; fail-closed 503 until PARTNER_QUICKSITES_SECRET is set (via the render client).
// NOTE: the sibling static segment /render takes precedence, so this only matches real instance ids.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { pollTalkingDemo, TalkingDemoError } from '@/lib/talkingDemo/renderClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { instanceId } = await params;
  if (!instanceId) return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });

  // A grant token (query, optional) mirrors the render call — the poll is partner-scoped either way.
  const grant = req.nextUrl.searchParams.get('grant') || undefined;

  try {
    const render = await pollTalkingDemo(instanceId, grant);
    return NextResponse.json({ ok: true, render });
  } catch (e: any) {
    const status = e instanceof TalkingDemoError ? e.status : 502;
    return NextResponse.json({ error: e?.message || 'poll failed' }, { status });
  }
}
