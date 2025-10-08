// app/api/admin/sites/unpublish/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

function x(err: any) {
  if (!err) return null;
  return {
    code: err.code ?? null,
    message: err.message ?? String(err),
    details: err.details ?? null,
    hint: err.hint ?? null,
  };
}

async function handle(req: Request, verb: 'GET' | 'POST' | 'DELETE') {
  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';

  const trace: any[] = [];
  const note = (msg: string, data?: any) =>
    trace.push({ t: new Date().toISOString(), msg, ...(data ? { data } : {}) });

  try {
    const pub = supabaseAdmin.schema('public');

    // Accept ids via POST body or query
    let body: any = {};
    if (verb === 'POST' || verb === 'DELETE') {
      try { body = await req.json(); } catch {}
    }

    const templateId =
      (body?.templateId || body?.tid || url.searchParams.get('templateId') || url.searchParams.get('tid'))?.trim();

    // Optional behavior:
    // - "hard" (default): delete from published_sites (frees domain immediately)
    // - "soft": keep row but null out domain/snapshot and mark status
    const mode =
      (body?.mode || url.searchParams.get('mode') || 'hard')
        .toString()
        .toLowerCase() as 'hard' | 'soft';

    note('incoming', { method: verb, templateId, mode });

    if (!templateId) return j({ error: 'templateId required' }, 400);

    // Make sure the template exists (for better errors and event logging)
    const tplRes = await pub
      .from('templates')
      .select('id, slug, template_name')
      .eq('id', templateId)
      .maybeSingle();

    if (tplRes.error || !tplRes.data) {
      return j(
        { error: tplRes.error?.message || 'template not found', debug: debug ? { step: 'template', err: x(tplRes.error) } : undefined },
        404
      );
    }

    // Perform unpublish
    let affected = 0;
    let action: 'hard-delete' | 'soft-unpublish' = 'hard-delete';
    let lastError: any = null;

    if (mode === 'soft') {
      action = 'soft-unpublish';
      const upd = await pub
        .from('published_sites')
        .update({
          status: 'unpublished',
          is_public: false,
          domain: null,
          snapshot_id: null,
          published_at: null,
        })
        .eq('template_id', templateId);
      if (upd.error) {
        lastError = x(upd.error);
        note('soft update error', { err: lastError });
      }
      affected = upd.count ?? 0; // may be null if count disabled
    } else {
      const del = await pub
        .from('published_sites')
        .delete()
        .eq('template_id', templateId);
      if (del.error) {
        lastError = x(del.error);
        note('hard delete error', { err: lastError });
      }
      affected = del.count ?? 0;
    }

    // Best-effort event log
    try {
      await logTemplateEvent({
        templateId,
        type: 'unpublish',
        meta: { action, affected, lastError: debug ? lastError : undefined },
      } as any);
    } catch (e: any) {
      note('logTemplateEvent failed', { err: String(e?.message || e) });
    }

    return j(
      {
        ok: !lastError,
        templateId,
        mode,
        action,
        affected,
        debug: debug ? { lastError, trace } : undefined,
      },
      lastError ? 500 : 200
    );
  } catch (e: any) {
    return j({ error: e?.message || 'unpublish failed' }, 500);
  }
}

export async function GET(req: Request)     { return handle(req, 'GET'); }
export async function POST(req: Request)    { return handle(req, 'POST'); }
export async function DELETE(req: Request)  { return handle(req, 'DELETE'); }
