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
  return (m.includes('relation') && m.includes('does not exist')) || m.includes('not exist');
}

function stableStringify(v: any) {
  if (v == null) return 'null';
  if (typeof v !== 'object') return String(v);
  const keys = Object.keys(v).sort();
  const o: Record<string, any> = {};
  for (const k of keys) o[k] = v[k];
  return JSON.stringify(o);
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);

    // ---- accept both query and JSON body ----
    const qTemplateId = url.searchParams.get('templateId') || url.searchParams.get('id');
    const qSnapshotId = url.searchParams.get('snapshotId');
    const qMessage    = url.searchParams.get('message') ?? undefined;

    let bTemplateId: string | undefined;
    let bSnapshotId: string | undefined;
    let bMessage: string | undefined;
    try {
      const body = await req.json();
      bTemplateId = typeof body?.templateId === 'string' ? body.templateId
                  : typeof body?.id === 'string' ? body.id : undefined;
      bSnapshotId = typeof body?.snapshotId === 'string' ? body.snapshotId : undefined;
      bMessage    = typeof body?.message === 'string' ? body.message : undefined;
    } catch { /* no JSON body */ }

    const templateId = (qTemplateId || bTemplateId || '').trim();
    let snapshotId   = (qSnapshotId || bSnapshotId || '').trim() || undefined;
    const message    = (qMessage || bMessage || undefined) ?? 'Manual publish';

    if (!templateId) return j({ ok: false, error: 'templateId required' }, 400);

    const pub = supabaseAdmin.schema('public');
    const app = supabaseAdmin.schema('app');

    // ---- 1) Load authoritative template row ----
    const { data: tpl, error: tErr } = await pub
      .from('templates')
      .select('id, data, template_name, updated_at')
      .eq('id', templateId)
      .single();

    if (tErr || !tpl) {
      return j({ ok: false, error: tErr?.message ?? 'template not found', templateId }, 404);
    }

    // ---- 2) Resolve snapshot (verify belongs-to) ----
    let version: any | null = null;

    if (snapshotId) {
      const { data, error } = await pub
        .from('template_versions')
        .select('id, template_id, full_data, saved_at')
        .eq('id', snapshotId)
        .maybeSingle();

      if (error && !isMissingRelation(error.message)) {
        return j({ ok: false, error: error.message, templateId, snapshotId }, 500);
      }
      version = data ?? null;

      if (version?.template_id && version.template_id !== templateId) {
        return j({ ok: false, error: 'snapshot does not belong to template', templateId, snapshotId }, 400);
      }
    } else {
      const { data, error } = await pub
        .from('template_versions')
        .select('id, template_id, full_data, saved_at')
        .eq('template_id', templateId)
        .order('saved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (!isMissingRelation(error.message)) {
          return j({ ok: false, error: error.message, templateId }, 500);
        }
        if (DEBUG) dbg('template_versions missing; proceeding without snapshot');
      }

      version = data ?? null;
      snapshotId = version?.id ?? undefined;
    }

    // ---- 3) Hash content (snapshot preferred, fall back to live template) ----
    const content = version?.full_data ?? tpl.data ?? {};
    const hash = sha256(stableStringify(content));

    // ---- 4) Attempt RPCs (cover both PostgREST exposure styles) ----
    const attempts: Array<{ where: string; ok: boolean; error?: string }> = [];

    // Accept ANY callable; normalize promise/builder/thenable inside.
    async function tryRpc(label: string, call: () => any) {
      try {
        const out = call();
        const res = typeof out?.then === 'function' ? await out : await out; // normalize PromiseLike/builder
        const error = res?.error ?? null;
        if (error) {
          attempts.push({ where: label, ok: false, error: error.message });
          if (DEBUG) dbg(`${label} failed:`, error.message);
          return false;
        }
        attempts.push({ where: label, ok: true });
        if (DEBUG) dbg(`${label} ok`);
        return true;
      } catch (e: any) {
        attempts.push({ where: label, ok: false, error: e?.message || String(e) });
        if (DEBUG) dbg(`${label} threw:`, e?.message || e);
        return false;
      }
    }

    // Because the SQL function returns TABLE, supabase-js v2 uses a builder.
    // Finish with .select('published_id').single() so we get a concrete response.
    const ran =
      (await tryRpc('rpc(app_publish_site)', () =>
        supabaseAdmin
          .rpc('app_publish_site', {
            p_template_id: templateId,
            p_snapshot_id: snapshotId ?? null,
            p_message: message ?? null,
          })
          .select('published_id')
          .single()
      )) ||
      (await tryRpc('schema(app).rpc(publish_site)', () =>
        app
          .rpc('publish_site', {
            p_template_id: templateId,
            p_snapshot_id: snapshotId ?? null,
            p_message: message ?? null,
          })
          .select('published_id')
          .single()
      )) ||
      (await tryRpc('rpc(public_publish_site)', () =>
        supabaseAdmin
          .rpc('public_publish_site', {
            p_template_id: templateId,
            p_snapshot_id: snapshotId ?? null,
            p_message: message ?? null,
          })
          .select('published_id')
          .single()
      )) ||
      (await tryRpc('schema(public).rpc(publish_site)', () =>
        pub
          .rpc('publish_site', {
            p_template_id: templateId,
            p_snapshot_id: snapshotId ?? null,
            p_message: message ?? null,
          })
          .select('published_id')
          .single()
      ));

    const tookMs = Date.now() - startedAt;

    return j({
      ok: true,
      templateId,
      snapshotId: snapshotId ?? null,
      hash,
      message,
      rpcAttempted: attempts,
      rpcRan: ran,
      note: ran
        ? 'Publish RPC executed.'
        : 'No publish RPC found or all attempts failed. Create and grant app.publish_site() or public.publish_site().',
      tookMs,
    }, 200);
  } catch (e: any) {
    return j({ ok: false, error: e?.message || 'publish failed' }, 500);
  }
}
