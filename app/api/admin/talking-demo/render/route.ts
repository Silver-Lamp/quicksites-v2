// app/api/admin/talking-demo/render/route.ts
//
// Talking Demo Tier 2 — generate a stepped tour for a template and (when configured) render it via
// HJ. QS owns the script: template blocks → buildTourScript → [{caption,say,dwell_ms?}]; HJ narrates.
//
// - dryRun (or when the render rails aren't configured yet) → returns just the generated SCRIPT — works
//   today with no secret, so an admin can preview the auto-generated tour for any site.
// - configured + not dryRun → POSTs the script to HJ's /render and returns the narrated result
//   (crosstalk/contracts/talking-demo-render.md). Fail-closed 503 until PARTNER_QUICKSITES_SECRET is set.
//
// Admin-gated (calling HJ render is metered/billed). Public visitor-facing render+cache is a follow-up.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildTalkingDemoScript } from '@/lib/talkingDemo/buildTourScript';
import { renderTalkingDemo, TalkingDemoError, talkingDemoRenderConfigured } from '@/lib/talkingDemo/renderClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const str = (v: any): string => (typeof v === 'string' ? v.trim() : '');

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const templateId = str(body.templateId) || str(body.id);
  if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 });

  const { data: tpl, error } = await (supabaseAdmin as any)
    .from('templates')
    .select('id, data, business_name, template_name')
    .eq('id', templateId)
    .maybeSingle();
  if (error || !tpl) return NextResponse.json({ error: 'template not found' }, { status: 404 });

  const businessName = str(tpl.business_name) || str(tpl.template_name) || 'this business';
  const blocks: any[] = tpl?.data?.pages?.[0]?.blocks ?? tpl?.data?.blocks ?? [];
  const voice = body.voice === 'owner_clone' ? 'owner_clone' : 'house';
  const wantMp4 = body.wantMp4 === true; // Phase B: request the shareable MP4 reel (async, poll for it)
  const script = buildTalkingDemoScript({
    instanceRef: templateId,
    businessName,
    blocks,
    voice,
    wantMp4,
    title: str(body.title) || businessName,
  });

  // Dry-run, or not configured yet → return the generated script only (no HJ call). Works today.
  if (body.dryRun === true || !talkingDemoRenderConfigured()) {
    return NextResponse.json({ ok: true, configured: talkingDemoRenderConfigured(), dryRun: true, script });
  }

  // Configured → render via HJ. A grant token unlocks the owner's own cloned voice (else house).
  try {
    const render = await renderTalkingDemo(script, str(body.grant) || undefined);
    return NextResponse.json({ ok: true, configured: true, script, render });
  } catch (e: any) {
    const status = e instanceof TalkingDemoError ? e.status : 502;
    return NextResponse.json({ error: e?.message || 'render failed', script }, { status });
  }
}
