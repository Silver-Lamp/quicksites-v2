export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';

function normalizeAssets(_data: any) {
  // TODO: resolve external images -> proxied/storage, etc.
  return {};
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get('templateId');
  if (!templateId) return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });

  // Load current draft
  const { data: t, error: tErr } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', templateId)
    .single();

  if (tErr || !t) return NextResponse.json({ error: tErr?.message ?? 'Template not found' }, { status: 404 });

  const hash = sha256(t.data);
  const assets_resolved = normalizeAssets(t.data);

  const { data: snap, error: sErr } = await supabaseAdmin
    .from('snapshots')
    .insert({
      template_id: templateId,
      rev: t.rev,
      data: t.data,
      hash,
      assets_resolved,
    })
    .select('id, rev, hash, created_at')
    .single();

  if (sErr || !snap) return NextResponse.json({ error: sErr?.message ?? 'Snapshot failed' }, { status: 500 });

  await logTemplateEvent({
    template_id: templateId,
    type: 'snapshot',
    rev_before: t.rev,
    rev_after: t.rev,
  });

  return NextResponse.json({ snapshotId: snap.id, rev: snap.rev, hash: snap.hash, createdAt: snap.created_at });
}
