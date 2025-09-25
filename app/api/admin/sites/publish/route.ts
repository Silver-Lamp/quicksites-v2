// app/api/admin/sites/publish/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { sha256 } from '@/lib/server/templateUtils';

const DEBUG = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG) console.log('[PUBLISH]', ...args); };

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

function isMissingRelation(msg?: string | null) {
  const m = String(msg || '').toLowerCase();
  return m.includes('relation') && m.includes('does not exist');
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  try {
    const url = new URL(req.url);
    const qTemplateId = url.searchParams.get('templateId') || url.searchParams.get('id');
    const qSnapshotId = url.searchParams.get('snapshotId');

    let bTemplateId: string | undefined;
    let bSnapshotId: string | undefined;
    let message: string | undefined;
    try {
      const body = await req.json();
      bTemplateId = typeof body?.templateId === 'string' ? body.templateId :
                    (typeof body?.id === 'string' ? body.id : undefined);
      bSnapshotId = typeof body?.snapshotId === 'string' ? body.snapshotId : undefined;
      message     = typeof body?.message === 'string' ? body.message : undefined;
    } catch { /* GET / no JSON body */ }

    const templateId = (qTemplateId || bTemplateId || '').trim();
    let snapshotId   = (qSnapshotId || bSnapshotId || '').trim() || undefined;
    if (!templateId) return j({ error: 'templateId required' }, 400);

    const pub = supabaseAdmin.schema('public');

    // 1) Load template (authoritative)
    const { data: tpl, error: tErr } = await pub
      .from('templates')
      .select('id, data, template_name, updated_at')
      .eq('id', templateId)
      .single();
    if (tErr || !tpl) return j({ error: tErr?.message ?? 'template not found' }, 404);

    // 2) Resolve snapshot/version
    let version: any | null = null;
    if (snapshotId) {
      const { data, error } = await pub
        .from('template_versions')
        .select('id, template_id, full_data, saved_at')
        .eq('id', snapshotId)
        .maybeSingle();
      if (error && !isMissingRelation(error.message)) return j({ error: error.message }, 500);
      version = data ?? null;
      if (version?.template_id && version.template_id !== templateId) {
        return j({ error: 'snapshot does not belong to template' }, 400);
      }
    } else {
      const { data, error } = await pub
        .from('template_versions')
        .select('id, template_id, full_data, saved_at')
        .eq('template_id', templateId)
        .order('saved_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && !isMissingRelation(error.message)) return j({ error: error.message }, 500);
      version = data ?? null;
      snapshotId = version?.id ?? undefined;
    }

    // 3) Derive a content hash (helpful for deployments/CDN keys)
    const content = version?.full_data ?? tpl.data ?? {};
    const hash = sha256(content);

    // 4) Try a publish RPC if you add one later (ignored if missing)
    //    We try public then app; both calls are best-effort.
    try {
      const rpc1 = await pub.rpc('publish_site', {
        p_template_id: templateId,
        p_snapshot_id: snapshotId ?? null,
        p_message: message ?? null,
      } as any);
      if (rpc1.error && DEBUG) dbg('public.publish_site ignored:', rpc1.error.message);

      const rpc2 = await supabaseAdmin.schema('app').rpc('publish_site', {
        p_template_id: templateId,
        p_snapshot_id: snapshotId ?? null,
        p_message: message ?? null,
      } as any);
      if (rpc2.error && DEBUG) dbg('app.publish_site ignored:', rpc2.error.message);
    } catch (e: any) {
      if (DEBUG) dbg('publish_site rpc threw (ignored):', e?.message);
    }

    // 5) IMPORTANT: do NOT update public.templates directly here (DB guard).
    //    If you need to persist "published" or "commit" flags, do it via your
    //    commit RPC (app.commit_template*) or a dedicated-safe RPC, not a direct UPDATE.

    return j({
      ok: true,
      templateId,
      snapshotId: snapshotId ?? null,
      hash,
      note: 'Published (metadata only). No direct template updates were attempted due to DB guard.',
    }, 200);
  } catch (e: any) {
    return j({ error: e?.message || 'publish failed' }, 500);
  }
}
