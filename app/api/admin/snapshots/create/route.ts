// app/api/admin/snapshots/create/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';
import { diffBlocks } from '@/lib/diff/blocks';

const DEBUG = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG) console.log('[SNAPSHOT]', ...args); };

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

function isMissingRelation(errMsg?: string | null) {
  const m = String(errMsg || '').toLowerCase();
  return m.includes('relation') && m.includes('does not exist');
}
function isMissingColumn(errMsg?: string | null) {
  const m = String(errMsg || '').toLowerCase();
  return m.includes('column') && m.includes('does not exist');
}

/** keep the payload small but useful */
function slimBlockDiff(bd: ReturnType<typeof diffBlocks>) {
  const sample = <T,>(arr: T[], n = 3) => arr.slice(0, n);
  return {
    counts: { added: bd.added.length, changed: bd.modified.length, removed: bd.removed.length },
    addedByType: bd.addedByType,
    modifiedByType: bd.modifiedByType,
    removedByType: bd.removedByType,
    added: sample(bd.added),
    modified: sample(bd.modified),
    removed: sample(bd.removed),
  };
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  try {
    const url = new URL(req.url);
    const qId = url.searchParams.get('templateId') || url.searchParams.get('id');

    let bodyId: string | undefined;
    let message: string | undefined;
    try {
      const body = await req.json();
      bodyId = typeof body?.templateId === 'string' ? body.templateId :
               (typeof body?.id === 'string' ? body.id : undefined);
      message = typeof body?.message === 'string' ? body.message : undefined;
    } catch { /* GET or non-JSON body */ }

    const templateId = (qId || bodyId || '').trim();
    if (!templateId) return j({ error: 'Missing templateId' }, 400);

    const pub = supabaseAdmin.schema('public');

    // 1) Load current template (authoritative snapshot source)
    const { data: tpl, error: tErr } = await pub
      .from('templates')
      .select('id, template_name, data, updated_at')
      .eq('id', templateId)
      .single();

    if (tErr || !tpl) return j({ error: tErr?.message ?? 'Template not found' }, 404);

    // 2) Previous version for diff context (public.template_versions)
    const { data: prevVer, error: prevErr } = await pub
      .from('template_versions')
      .select('id, full_data, saved_at')
      .eq('template_id', templateId)
      .order('saved_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevErr && !isMissingRelation(prevErr.message)) {
      dbg('previous version select error (ignored):', prevErr.message);
    }

    // 3) Diff (best-effort)
    let bdSlim:
      | {
          counts: { added: number; changed: number; removed: number };
          addedByType: Record<string, number>;
          modifiedByType: Record<string, number>;
          removedByType: Record<string, number>;
          added: any[]; modified: any[]; removed: any[];
        }
      | undefined;

    try {
      const bd = diffBlocks({ data: prevVer?.full_data ?? {} }, { data: tpl.data ?? {} });
      bdSlim = slimBlockDiff(bd);
    } catch (e: any) {
      dbg('diffBlocks failed (ignored):', e?.message);
    }

    // 4) Insert new version into public.template_versions
    const record: any = {
      template_id: tpl.id,
      template_name: tpl.template_name ?? null,
      full_data: tpl.data ?? {},
      diff: bdSlim ?? null,
      commit_message: message ?? null,
      editor_id: null,          // wire to your session user id if available
      forced_revert: false,
      thumbnail_url: null,
    };

    let ins = await pub
      .from('template_versions')
      .insert(record)
      .select('id, saved_at, created_at');

    if (ins.error) {
      // If table/column missing → noop (don’t break publish flow)
      if (isMissingRelation(ins.error.message) || isMissingColumn(ins.error.message)) {
        dbg('template_versions missing (noop success):', ins.error.message);
        return j({ ok: true, templateId, snapshotId: null, versionId: null, noop: true }, 200);
      }
      return j({ error: ins.error.message || 'Snapshot failed' }, 500);
    }

    const row = ins.data?.[0];
    const hash = sha256(tpl.data);

    // 5) Log snapshot event (best-effort)
    try {
      const meta = (tpl.data as any)?.meta ?? {};
      const services =
        Array.isArray((tpl.data as any)?.services)
          ? (tpl.data as any).services
          : meta?.services ?? undefined;

      await logTemplateEvent({
        templateId,
        type: 'snapshot',
        revBefore: null,
        revAfter: null,
        diff: bdSlim?.counts ?? null,
        meta: {
          blockDiff: bdSlim,
          snapshot: { id: row?.id ?? null, createdAt: row?.saved_at ?? row?.created_at ?? null, hash },
          industry: typeof meta?.industry === 'string' ? meta.industry : undefined,
          services,
          table: 'template_versions',
        },
      } as any);
    } catch (e: any) {
      dbg('logTemplateEvent failed (ignored):', e?.message);
    }

    // 6) Return BOTH names for back-compat with callers
    return j({
      ok: true,
      snapshotId: row?.id ?? null,   // ← what the publish step expects
      versionId: row?.id ?? null,    // ← alternate name for clarity
      savedAt: row?.saved_at ?? row?.created_at ?? null,
      hash,
    }, 200);
  } catch (e: any) {
    return j({ error: e?.message || 'Snapshot failed' }, 500);
  }
}
