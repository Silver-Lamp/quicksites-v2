// app/api/admin/snapshots/create/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';
import { diffBlocks } from '@/lib/diff/blocks';

function normalizeAssets(_data: any) {
  // TODO: resolve external images -> proxied/storage, etc.
  return {};
}

// keep rows small: store aggregates + tiny samples
function slimBlockDiff(bd: ReturnType<typeof diffBlocks>) {
  const sample = <T,>(arr: T[], n = 3) => arr.slice(0, n);
  return {
    addedByType: bd.addedByType,
    modifiedByType: bd.modifiedByType,
    removedByType: bd.removedByType,
    added: sample(bd.added),
    modified: sample(bd.modified),
    removed: sample(bd.removed),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId');
    if (!templateId) {
      return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });
    }

    // Load current draft (the source of truth we are snapshotting)
    const { data: t, error: tErr } = await supabaseAdmin
      .from('templates')
      .select('id, data, rev')
      .eq('id', templateId)
      .single();

    if (tErr || !t) {
      return NextResponse.json({ error: tErr?.message ?? 'Template not found' }, { status: 404 });
    }

    // Load previous snapshot (for block-diff context)
    const { data: prevSnap } = await supabaseAdmin
      .from('snapshots')
      .select('id, rev, data, hash, created_at')
      .eq('template_id', templateId)
      .order('rev', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hash = sha256(t.data);
    const assets_resolved = normalizeAssets(t.data);

    // Create new snapshot from the current draft
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

    if (sErr || !snap) {
      return NextResponse.json({ error: sErr?.message ?? 'Snapshot failed' }, { status: 500 });
    }

    // Compute block diff: previous snapshot → this snapshot
    let blockDiffSlim:
      | {
          addedByType: Record<string, number>;
          modifiedByType: Record<string, number>;
          removedByType: Record<string, number>;
          added: any[];
          modified: any[];
          removed: any[];
        }
      | undefined;
    let diffCounts: { added: number; changed: number; removed: number } | undefined;

    try {
      const bd = diffBlocks(
        { data: prevSnap?.data ?? {} },
        { data: t.data ?? {} }
      );
      blockDiffSlim = slimBlockDiff(bd);
      diffCounts = {
        added: bd.added.length,
        changed: bd.modified.length,
        removed: bd.removed.length,
      };
    } catch {
      // non-blocking
    }

    // Light meta context for the tracker (industry/services if present)
    const meta = (t.data as any)?.meta ?? {};
    const services =
      Array.isArray((t.data as any)?.services)
        ? (t.data as any).services
        : meta?.services ?? undefined;

    // Log snapshot event (non-blocking semantics inside the logger)
    await logTemplateEvent({
      template_id: templateId,
      type: 'snapshot',
      rev_before: prevSnap?.rev ?? null,
      rev_after: snap.rev ?? t.rev,
      diff: diffCounts ?? null,
      meta: {
        blockDiff: blockDiffSlim, // chips source for TruthTracker
        snapshot: { id: snap.id, rev: snap.rev, createdAt: snap.created_at },
        prevSnapshotId: prevSnap?.id ?? null,
        industry: typeof meta?.industry === 'string' ? meta.industry : undefined,
        services,
      },
    });

    return NextResponse.json({
      snapshotId: snap.id,
      rev: snap.rev,
      hash: snap.hash,
      createdAt: snap.created_at,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Snapshot failed' }, { status: 500 });
  }
}
