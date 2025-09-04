// app/api/templates/commit/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';
import { diffBlocks } from '@/lib/diff/blocks';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';

/**
 * POST /api/templates/commit
 * Body: { id: string, baseRev?: number, patch: object, kind?: 'save' | 'autosave' }
 *
 * Behavior:
 * - On success: { id, rev, hash, kind }
 * - On merge conflict (409): { error: 'merge_conflict', rev }  ← includes CURRENT rev
 * - On other errors: { error }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { id, baseRev, patch, kind } = body as {
      id: string;
      baseRev?: number;
      patch: Record<string, any>;
      kind?: 'save' | 'autosave';
    };

    // Input verification (id + patch only; baseRev can be inferred)
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    if (!patch || typeof patch !== 'object') {
      return NextResponse.json({ error: 'patch required (object)' }, { status: 400 });
    }

    // Defensive: never let system columns through in the patch
    try {
      delete (patch as any).base_slug;
      delete (patch as any).is_version;
      delete (patch as any).rev;            // client must not set rev directly
      delete (patch as any).updated_at;
      delete (patch as any).created_at;
      delete (patch as any).owner_id;
      delete (patch as any).published_version_id;
    } catch {}

    // Keep actor null unless you wire a real user id
    const actor: string | null = null;

    // ----- Load BEFORE draft and infer baseRev if needed -----
    const { data: beforeRow, error: beforeErr } = await supabaseAdmin
      .from('templates')
      .select('rev, data')
      .eq('id', id)
      .single();

    if (beforeErr || !beforeRow) {
      return NextResponse.json({ error: beforeErr?.message || 'template not found' }, { status: 404 });
    }

    const beforeRev = typeof (beforeRow as any).rev === 'number' ? (beforeRow as any).rev : 0;
    const beforeData = (beforeRow as any).data ?? {};

    // If caller didn’t pass a number, fall back to the current DB rev
    const effectiveBaseRev = Number.isFinite(baseRev as number) ? (baseRev as number) : beforeRev;

    // ----- RPC — commit with optimistic concurrency -----
    const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc('commit_template', {
      p_id: id,
      p_base_rev: effectiveBaseRev,
      p_patch: patch,
      p_actor: actor,
      p_kind: kind ?? 'save',
    });

    // Handle merge conflicts & other RPC errors
    if (rpcErr) {
      const msg = String(rpcErr.message || '');
      const isConflict = msg.includes('merge_conflict') || /conflict/i.test(msg);

      if (isConflict) {
        // Fetch CURRENT rev so the client can retry immediately
        const { data: curRow } = await supabaseAdmin
          .from('templates')
          .select('rev')
          .eq('id', id)
          .maybeSingle();

        const currentRev =
          (curRow && typeof (curRow as any).rev === 'number' && (curRow as any).rev) || beforeRev;

        return NextResponse.json(
          { error: 'merge_conflict', rev: currentRev },
          { status: 409 }
        );
      }

      const status = msg.toLowerCase().includes('not found') ? 404 : 500;
      return NextResponse.json({ error: msg || 'commit failed' }, { status });
    }

    // Success path — get next revision from RPC (preferred), fallback to base+1
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    const nextRev = typeof row?.rev === 'number' ? row.rev : effectiveBaseRev + 1;

    // Reload current data to compute content hash (and to diff blocks)
    const { data: cur, error: selErr } = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('id', id)
      .single();

    if (selErr) {
      // Still return the rev even if hashing/diff fails
      return NextResponse.json({ id, rev: nextRev, hash: undefined, kind: kind ?? 'save' });
    }

    const afterData = (cur as any)?.data ?? {};
    const hash = sha256(afterData);

    // ----- Block diff & event log (non-blocking semantics) -----
    try {
      const bd = diffBlocks({ data: beforeData }, { data: afterData });
      const blockDiff = {
        addedByType: bd.addedByType,
        modifiedByType: bd.modifiedByType,
        removedByType: bd.removedByType,
        added: bd.added.slice(0, 3),
        modified: bd.modified.slice(0, 3),
        removed: bd.removed.slice(0, 3),
      };

      const type: 'save' | 'autosave' = (kind === 'autosave' ? 'autosave' : 'save');
      const afterMeta = (afterData as any)?.meta ?? {};

      await logTemplateEvent({
        templateId: id, // camelCase accepted by the logger
        type,
        revBefore: beforeRev,
        revAfter: nextRev,
        diff: {
          added: bd.added.length,
          changed: bd.modified.length,
          removed: bd.removed.length,
        },
        meta: {
          blockDiff,
          industry: typeof afterMeta?.industry === 'string' ? afterMeta.industry : undefined,
          services:
            Array.isArray((afterData as any)?.services)
              ? (afterData as any).services
              : afterMeta?.services ?? undefined,
          before: { rev: beforeRev, data: beforeData },
          after:  { rev: nextRev,  data: afterData  },
        },
      } as any);
    } catch {
      /* swallow diff/log failures — commit succeeded */
    }

    return NextResponse.json({ id, rev: nextRev, hash, kind: kind ?? 'save' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'commit failed' }, { status: 500 });
  }
}
