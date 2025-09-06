export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';

const normalizeAssets = (_: any) => ({});

function ok(body: any, status = 200) { return NextResponse.json(body, { status }); }
function err(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'site';
}

async function ensureSiteForTemplate(templateId: string) {
  // try existing
  {
    const { data, error } = await supabaseAdmin
      .from('sites')
      .select('id, slug, domain, published_snapshot_id, published_rev')
      .eq('template_id', templateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
  }

  // need template to derive slug
  const { data: t, error: tErr } = await supabaseAdmin
    .from('templates')
    .select('id, slug, data')
    .eq('id', templateId)
    .single();
  if (tErr || !t) throw new Error('Template not found');

  const metaTitle =
    (t.data as any)?.meta?.siteTitle ||
    (t.data as any)?.meta?.title ||
    t.slug || 'site';
  const base = slugify(metaTitle);
  let slug = base;

  // mint unique slug
  for (let i = 0; i < 20; i++) {
    const { count, error } = await supabaseAdmin
      .from('sites')
      .select('id', { head: true, count: 'exact' })
      .eq('slug', slug);
    if (error) throw new Error(error.message);
    if (!count) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const initData = { meta: (t.data as any)?.meta ?? {} };
  const { data: created, error: insErr } = await supabaseAdmin
    .from('sites')
    .insert({ template_id: templateId, slug, data: initData })
    .select('id, slug, domain, published_snapshot_id, published_rev')
    .single();
  
  if (insErr || !created) throw new Error(insErr?.message || 'Site create failed');

  return created;
}

async function ensureSnapshot(templateId: string, snapshotId?: string | null) {
  if (snapshotId) {
    const { data, error } = await supabaseAdmin
      .from('snapshots')
      .select('id, rev, template_id')
      .eq('id', snapshotId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.template_id !== templateId) {
      throw new Error('Snapshot not found for template');
    }
    return data;
  }

  // else create/reuse latest for current draft
  const { data: t, error: tErr } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', templateId)
    .single();
  if (tErr || !t) throw new Error('Template not found');

  const body = typeof t.data === 'string' ? t.data : JSON.stringify(t.data ?? {});
  const hash = sha256(body);

  const { data: last, error: lErr } = await supabaseAdmin
    .from('snapshots')
    .select('id, rev, hash')
    .eq('template_id', templateId)
    .order('rev', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lErr) throw new Error(lErr.message);

  if (last && last.rev === t.rev && last.hash === hash) return last;

  const { data: snap, error: sErr } = await supabaseAdmin
    .from('snapshots')
    .insert({
      template_id: templateId,
      rev: t.rev,
      data: t.data,
      hash,
      assets_resolved: normalizeAssets(t.data),
    })
    .select('id, rev')
    .single();
  if (sErr || !snap) throw new Error(sErr?.message || 'Snapshot insert failed');

  return snap;
}

async function doPublish(req: Request) {
  const url = new URL(req.url);
  const templateId = url.searchParams.get('templateId') || undefined;
  const snapshotId = url.searchParams.get('snapshotId');

  if (!templateId) return err('Missing templateId', 400);

  const site = await ensureSiteForTemplate(templateId);
  const snap = await ensureSnapshot(templateId, snapshotId);

  const { error: upErr } = await supabaseAdmin
    .from('sites')
    .update({
      published_snapshot_id: snap.id,
      published_rev: snap.rev,
      published_at: new Date().toISOString(),
    })
    .eq('id', site.id);
  if (upErr) throw new Error(upErr.message);

  const urlOut = site.domain
    ? `https://${site.domain}`
    : `https://${site.slug}.quicksites.ai`;

  return ok({
    siteId: site.id,
    slug: site.slug,
    domain: site.domain,
    snapshotId: snap.id,
    rev: snap.rev,
    url: urlOut,
    publishedAt: new Date().toISOString(),
  });
}

export async function GET(req: Request) {
  try { return await doPublish(req); }
  catch (e: any) { return err(e?.message || 'Publish failed', 500); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    if (body?.templateId && !url.searchParams.get('templateId')) {
      url.searchParams.set('templateId', body.templateId);
    }
    if (body?.snapshotId && !url.searchParams.get('snapshotId')) {
      url.searchParams.set('snapshotId', body.snapshotId);
    }
    return await doPublish(new Request(url.toString(), req));
  } catch (e: any) {
    return err(e?.message || 'Publish failed', 500);
  }
}
