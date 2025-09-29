// app/api/admin/sites/restore/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}
const DEBUG = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG) console.log('[RESTORE]', ...args); };

const pub = supabaseAdmin.schema('public');

const isMissingRelation = (msg?: string) =>
  String(msg || '').toLowerCase().includes('relation') &&
  String(msg || '').toLowerCase().includes('does not exist');

const isMissingColumn = (msg?: string) =>
  String(msg || '').toLowerCase().includes('column') &&
  String(msg || '').toLowerCase().includes('does not exist');

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch {}

    const templateId =
      (body?.templateId || body?.tid || url.searchParams.get('templateId') || url.searchParams.get('tid'))?.trim();

    let snapshotId =
      (body?.snapshotId || body?.versionId || body?.sid ||
       url.searchParams.get('snapshotId') || url.searchParams.get('versionId') || url.searchParams.get('sid'))?.trim();

    const message = (body?.message || url.searchParams.get('message')) ?? null;

    if (!templateId) return j({ error: 'templateId required' }, 400);

    // 1) Verify template exists
    const tpl = await pub
      .from('templates')
      .select('id, data, template_name, slug, updated_at')
      .eq('id', templateId)
      .maybeSingle();
    if (tpl.error || !tpl.data) {
      dbg('template lookup failed', tpl.error?.message);
      return j({ error: tpl.error?.message || 'template not found' }, 404);
    }

    // 2) If snapshotId missing, use latest version for this template
    if (!snapshotId) {
      const latest = await pub
        .from('template_versions')
        .select('id, full_data, created_at')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest.error && latest.data?.id) {
        snapshotId = latest.data.id;
        dbg('no snapshotId provided; using latest version', snapshotId);
      }
    }
    if (!snapshotId) {
      // nothing to restore to; noop success
      return j({ ok: true, templateId, snapshotId: null, storedVia: 'noop' }, 200);
    }

    // 3) Fetch the version to restore
    const ver = await pub
      .from('template_versions')
      .select('id, full_data, created_at')
      .eq('id', snapshotId)
      .maybeSingle();
    if (ver.error || !ver.data) {
      dbg('version lookup failed (noop):', ver.error?.message);
      return j({ ok: true, templateId, snapshotId, storedVia: 'noop' }, 200);
    }

    // 4) Attempt to write templates.data = version.full_data
    let storedVia: 'templates_data' | 'noop' = 'noop';
    const newData = ver.data.full_data ?? {};

    const upd = await pub
      .from('templates')
      .update({ data: newData } as any)
      .eq('id', templateId)
      .select('id')
      .maybeSingle();

    if (!upd.error) {
      storedVia = 'templates_data';
    } else {
      // Some installations guard direct updates → treat as noop instead of failing the UX
      if (!isMissingColumn(upd.error.message) && !isMissingRelation(upd.error.message)) {
        dbg('templates.data restore failed (continuing as noop):', upd.error.message);
      }
    }

    // 5) Best-effort event log
    try {
      await logTemplateEvent({
        templateId,
        type: 'restore',
        meta: {
          snapshot: { id: snapshotId, restoredAt: new Date().toISOString() },
          storedVia,
          message,
        },
      } as any);
    } catch (e: any) {
      dbg('logTemplateEvent failed:', e?.message);
    }

    // 6) Done
    return j({ ok: true, templateId, snapshotId, storedVia }, 200);
  } catch (e: any) {
    return j({ error: e?.message || 'restore failed' }, 500);
  }
}
