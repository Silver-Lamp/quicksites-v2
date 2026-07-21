// app/api/admin/talking-demo/save/route.ts
//
// Persist a generated Talking Demo reel onto a template so it powers the public "watch" page
// (/watch/<slug>) — the outreach asset a no-website prospect scans ("here's the site we built you").
// Writes data.meta.talking_demo via the sanctioned commit_template RPC (direct UPDATEs are blocked),
// then returns the watch URL + a printable QR (PNG data URL) that encodes it.

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

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
  const ref = str(body.templateId) || str(body.id) || str(body.slug);
  const mp4_url = str(body.mp4_url);
  if (!ref) return NextResponse.json({ error: 'templateId or slug is required' }, { status: 400 });
  if (!mp4_url) return NextResponse.json({ error: 'mp4_url is required (generate the reel first)' }, { status: 400 });

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  const sel = (supabaseAdmin as any).from('templates').select('id, slug, rev, data');
  const { data: tpl, error } = await (isUuid ? sel.eq('id', ref) : sel.eq('slug', ref)).maybeSingle();
  if (error || !tpl) return NextResponse.json({ error: 'template not found' }, { status: 404 });
  if (!str(tpl.slug)) return NextResponse.json({ error: 'template has no slug (needed for the watch URL)' }, { status: 400 });

  const data = tpl.data ?? {};
  const talking_demo = {
    mp4_url,
    poster_url: str(body.poster_url) || null,
    steps: Array.isArray(body.steps) ? body.steps : [],
    instance_id: str(body.instance_id) || null,
    generated_at: new Date().toISOString(),
  };
  const newData = { ...data, meta: { ...(data.meta ?? {}), talking_demo } };

  const err = await commitTemplatePatch(tpl.id, tpl.rev ?? 0, { data: newData }, gate.user.id);
  if (err) return NextResponse.json({ error: err }, { status: 500 });

  const base = (process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://www.quicksites.ai').replace(/\/+$/, '');
  const watch_url = `${base}/watch/${str(tpl.slug)}`;
  const qr_data_url = await QRCode.toDataURL(watch_url, { width: 640, margin: 1, errorCorrectionLevel: 'M' });

  return NextResponse.json({ ok: true, watch_url, qr_data_url });
}
