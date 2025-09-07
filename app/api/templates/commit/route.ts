// app/api/templates/commit/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';
import { diffBlocks } from '@/lib/diff/blocks';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';

// optional: best-effort org (keeps single-tenant working)
let resolveOrg: undefined | (() => Promise<any>);
try { resolveOrg = require('@/lib/org/resolveOrg').resolveOrg; } catch {}

type Kind = 'save' | 'autosave';

// ⬇️ helper: accept number OR ResponseInit (Next 15 no longer accepts plain number)
function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

const isMergeConflict = (m: string) =>
  typeof m === 'string' && (m.includes('merge_conflict') || /conflict/i.test(m));

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { id, baseRev, patch, kind } = body as {
      id: string;
      baseRev?: number;
      patch: Record<string, any>;
      kind?: Kind;
    };

    if (!id || typeof id !== 'string') return j({ error: 'id required' }, 400);
    if (!patch || typeof patch !== 'object') return j({ error: 'patch required (object)' }, 400);

    // sanitize
    try {
      delete (patch as any).base_slug;
      delete (patch as any).is_version;
      delete (patch as any).rev;
      delete (patch as any).updated_at;
      delete (patch as any).created_at;
      delete (patch as any).owner_id;
      delete (patch as any).published_version_id;
    } catch {}

    // before state
    const { data: beforeRow, error: beforeErr } = await supabaseAdmin
      .from('templates')
      .select('rev, data')
      .eq('id', id)
      .single();

    if (beforeErr || !beforeRow) {
      return j({ error: beforeErr?.message || 'template not found' }, 404);
    }

    const beforeRev = typeof (beforeRow as any).rev === 'number' ? (beforeRow as any).rev : 0;
    const beforeData = (beforeRow as any).data ?? {};
    const effectiveBaseRev = Number.isFinite(baseRev as number) ? (baseRev as number) : beforeRev;

    // best-effort org
    let orgId: string | undefined;
    try {
      if (resolveOrg) {
        const org = await resolveOrg();
        if (org?.id) orgId = String(org.id);
      }
    } catch {}

    // single public RPC wrapper (see earlier SQL): public.commit_template_http(p_payload jsonb)
    const payload = {
      id,
      base_rev: effectiveBaseRev,
      patch,
      actor: null,
      kind: (kind ?? 'save') as Kind,
      org_id: orgId,
    };

    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc(
      'commit_template_http',
      { p_payload: payload } as any
    );

    if (rpcErr) {
      const msg = String(rpcErr.message || 'commit failed');

      if (isMergeConflict(msg)) {
        const { data: curRow } = await supabaseAdmin
          .from('templates')
          .select('rev')
          .eq('id', id)
          .maybeSingle();
        const currentRev =
          (curRow && typeof (curRow as any).rev === 'number' && (curRow as any).rev) || beforeRev;
        return j({ error: 'merge_conflict', rev: currentRev }, 409);
      }

      return j(
        {
          error: 'commit failed',
          rpc_error: msg,
          rpc_attempt: 'public.commit_template_http(p_payload jsonb)',
          hint:
            'Ensure the PUBLIC wrapper exists and delegates to app.commit_template(...).',
        },
        500
      );
    }

    // derive next rev; prefer DB-provided rev if present
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const nextRev =
      typeof row?.rev === 'number'
        ? row.rev
        : Number.isFinite(effectiveBaseRev)
        ? (effectiveBaseRev as number) + 1
        : beforeRev + 1;

    // reload to hash/diff
    const { data: cur, error: selErr } = await supabaseAdmin
      .from('templates')
      .select('data')
      .eq('id', id)
      .single();

    if (selErr) return j({ id, rev: nextRev, hash: undefined, kind: kind ?? 'save' });

    const afterData = (cur as any)?.data ?? {};
    const hash = sha256(afterData);

    // diff + log (best-effort)
    try {
      const bd = diffBlocks({ data: beforeData }, { data: afterData });
      const afterMeta = (afterData as any)?.meta ?? {};
      await logTemplateEvent({
        templateId: id,
        type: (kind === 'autosave' ? 'autosave' : 'save') as Kind,
        revBefore: beforeRev,
        revAfter: nextRev,
        diff: { added: bd.added.length, changed: bd.modified.length, removed: bd.removed.length },
        meta: {
          blockDiff: {
            addedByType: bd.addedByType,
            modifiedByType: bd.modifiedByType,
            removedByType: bd.removedByType,
            added: bd.added.slice(0, 3),
            modified: bd.modified.slice(0, 3),
            removed: bd.removed.slice(0, 3),
          },
          industry: typeof afterMeta?.industry === 'string' ? afterMeta.industry : undefined,
          services:
            Array.isArray((afterData as any)?.services)
              ? (afterData as any).services
              : afterMeta?.services ?? undefined,
          before: { rev: beforeRev, data: beforeData },
          after: { rev: nextRev, data: afterData },
        },
      } as any);
    } catch {}

    return j({ id, rev: nextRev, hash, kind: kind ?? 'save' });
  } catch (e: any) {
    return j({ error: e?.message || 'commit failed' }, 500);
  }
}
