// app/api/admin/sites/restore/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

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

    // Owner or admin — restoring your own site's history is an editor action (2026-10-23).
    const gate = await requireTemplateOwner(templateId);
    if (!gate.ok) return gate.response;

    // 1) Verify template exists
    const tpl = await pub
      .from('templates')
      .select('id, data, template_name, slug, updated_at, rev')
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
      // ⚠️ The version must belong to THIS template: unscoped, a caller could restore another
      // site's content (any id they had seen) into a site they own.
      .eq('template_id', templateId)
      .maybeSingle();
    if (ver.error || !ver.data) {
      return j({ error: 'That version does not belong to this site.' }, 404);
    }

    // 4) Attempt to write templates.data = version.full_data
    let storedVia: 'templates_data' | 'noop' = 'noop';
    const newData = ver.data.full_data ?? {};

    // ⚠️ Through the sanctioned RPC. This used to be a direct UPDATE, which the
    // guard_templates_update trigger refuses — and the refusal was swallowed as a "noop", so
    // Restore reported success and restored nothing, for every caller including admins.
    const commitErr = await commitTemplatePatch(templateId, Number((tpl.data as any).rev ?? 0), { data: newData }, gate.userId);
    if (commitErr) return j({ error: `Restore failed: ${commitErr}` }, 500);
    storedVia = 'templates_data';

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
