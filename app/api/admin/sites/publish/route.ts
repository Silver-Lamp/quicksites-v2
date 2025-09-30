// app/api/admin/sites/publish/route.ts
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

function canonSlug(v?: string | null) {
  const raw = String(v ?? '').trim().toLowerCase();
  if (!raw) return null;
  const slug = raw
    .replace(/[^a-z0-9-_.]/g, '-') // keep letters, digits, dash, underscore, dot
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

function deriveDomainFromTemplate(tpl: any) {
  const data = (tpl?.data ?? {}) as any;
  const meta = (data?.meta ?? {}) as any;

  const metaCustom = meta?.custom_domain ?? meta?.customDomain ?? null;
  const metaDomain = meta?.domain ?? null;
  const rootDomain = (data as any)?.domain ?? null;

  const slug = canonSlug(tpl?.slug) || canonSlug(tpl?.template_name);
  const fallback = slug ? `${slug}.quicksites.ai` : null;

  return (metaCustom || metaDomain || rootDomain || fallback) ?? null;
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';

  const trace: any[] = [];
  const note = (msg: string, data?: any) =>
    trace.push({ t: new Date().toISOString(), msg, ...(data ? { data } : {}) });

  try {
    const pub = supabaseAdmin.schema('public');

    // Accept ids via POST body or GET query
    let body: any = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch {}
    }
    const templateId =
      (body?.templateId || body?.tid || url.searchParams.get('templateId') || url.searchParams.get('tid'))?.trim();
    let snapshotId =
      (body?.snapshotId || body?.versionId || body?.sid ||
       url.searchParams.get('snapshotId') || url.searchParams.get('versionId') || url.searchParams.get('sid'))?.trim();

    note('incoming', { method: req.method, templateId, snapshotId });

    if (!templateId) return j({ error: 'templateId required' }, 400);

    // Load template (need slug/data to derive a domain)
    const tplRes = await pub
      .from('templates')
      .select('id, slug, template_name, data')
      .eq('id', templateId)
      .maybeSingle();

    if (tplRes.error || !tplRes.data) {
      return j(
        { error: tplRes.error?.message || 'template not found', debug: debug ? { step: 'template', err: x(tplRes.error) } : undefined },
        404
      );
    }
    const tpl = tplRes.data;
    note('template ok', { slug: tpl.slug });

    // If snapshotId missing, choose newest version for this template
    if (!snapshotId) {
      const latest = await pub
        .from('template_versions')
        .select('id, created_at')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest.error && latest.data?.id) {
        snapshotId = latest.data.id;
        note('autofilled snapshotId from latest version', { snapshotId });
      } else {
        note('no version found to autofill', { err: x(latest.error) });
      }
    }

    if (!snapshotId) {
      note('noop publish (no snapshotId)');
      return j({ ok: true, templateId, snapshotId: null, storedVia: 'noop', why: 'no snapshotId', debug: debug ? { trace } : undefined }, 200);
    }

    // Verify version exists (don’t hard-fail)
    const ver = await pub.from('template_versions').select('id').eq('id', snapshotId).maybeSingle();
    if (ver.error || !ver.data) {
      note('version lookup failed (continuing)', { err: x(ver.error) });
    }

    // Derive required domain
    const domain = deriveDomainFromTemplate(tpl);
    const finalDomain = domain ?? `${String(snapshotId).slice(0, 8)}.local.quicksites`;
    note('domain chosen', { finalDomain });

    // Canonical payload — always include template_id
    const payload = {
      template_id: templateId,
      snapshot_id: snapshotId,
      domain: finalDomain,
      published_at: new Date().toISOString(),
      status: 'published',
      is_public: true,
    } as const;

    let storedVia: 'upsert_by_template' | 'insert_with_id' | 'noop' = 'noop';
    let attempt: 'upsert' | 'retry_insert_with_id' = 'upsert';
    let lastError: any = null;

    // Preferred path: UPSERT by template_id
    let res = await pub
      .from('published_sites')
      .upsert(payload, { onConflict: 'template_id' }) // 1 live pointer per template
      .select('id')
      .maybeSingle();

    if (!res.error) {
      storedVia = 'upsert_by_template';
      note('upsert ok', { id: res.data?.id ?? null });
    } else {
      lastError = x(res.error);
      note('upsert error', { err: lastError });

      // Fallback: still include template_id (never write orphaned rows)
      attempt = 'retry_insert_with_id';
      res = await pub
        .from('published_sites')
        .insert({ id: crypto.randomUUID(), ...payload })
        .select('id')
        .maybeSingle();

      if (!res.error) {
        storedVia = 'insert_with_id';
        note('insert ok (with id)', { id: res.data?.id ?? null });
      } else {
        lastError = x(res.error);
        note('insert with id error', { err: lastError });
      }
    }

    // Best-effort event log
    try {
      await logTemplateEvent({
        templateId,
        type: 'publish',
        meta: { snapshot: { id: snapshotId }, domain: finalDomain, storedVia, attempt, lastError: debug ? lastError : undefined },
      } as any);
    } catch (e: any) {
      note('logTemplateEvent failed', { err: String(e?.message || e) });
    }

    return j(
      { ok: true, templateId, snapshotId, domain: finalDomain, storedVia, debug: debug ? { attempt, lastError, trace } : undefined },
      200
    );
  } catch (e: any) {
    return j({ error: e?.message || 'publish failed' }, 500);
  }
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
