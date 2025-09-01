export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';
import { revalidateTag } from 'next/cache';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get('templateId');
  const snapshotId  = searchParams.get('snapshotId');
  if (!templateId || !snapshotId) {
    return NextResponse.json({ error: 'Missing templateId or snapshotId' }, { status: 400 });
  }

  // Validate snapshot belongs to template
  const { data: snap, error: sErr } = await supabaseAdmin
    .from('snapshots')
    .select('id, template_id, rev')
    .eq('id', snapshotId)
    .single();

  if (sErr || !snap || snap.template_id !== templateId) {
    return NextResponse.json({ error: 'Snapshot not found for template' }, { status: 404 });
  }

  // Find site by template (assumes 1:1)
  const { data: site, error: siteErr } = await supabaseAdmin
    .from('sites')
    .select('id, slug, published_snapshot_id, template_id')
    .eq('template_id', templateId)
    .maybeSingle();

  if (siteErr || !site) return NextResponse.json({ error: 'Site not found for template' }, { status: 404 });

  const { error: updErr } = await supabaseAdmin
    .from('sites')
    .update({ published_snapshot_id: snapshotId })
    .eq('id', site.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await logTemplateEvent({
    template_id: templateId,
    type: 'publish',
    rev_before: snap.rev,
    rev_after: snap.rev,
  });

  try { revalidateTag(`site:${site.slug}`); } catch {}

  return NextResponse.json({ ok: true, siteId: site.id, slug: site.slug, snapshotId });
}
