// app/api/admin/templates/fill-local-business-schema/route.ts
//
// One-click "Add LocalBusiness schema" for the templates list / next-step button. Verifies a
// LocalBusiness JSON-LD can be built from the site's identity, flips meta.local_business_schema
// on, and commits via the sanctioned RPC (direct UPDATEs are trigger-blocked; CLAUDE.md §8).
// The public site emits the JSON-LD live from identity (app/sites/…), so it stays fresh.
//
// POST { templateId }
//   → { ok:true, changed:true, type }
//   → { ok:true, changed:false, reason:'already'|'insufficient' }
//   → { ok:false, reason:'no_template', error? }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildLocalBusinessSchema, localBusinessSchemaEnabled } from '@/lib/seo/localBusinessSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'templates-fill-schema', 120, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = String(body.templateId ?? '').trim();
  if (!templateId) return NextResponse.json({ ok: false, error: 'A templateId is required.' }, { status: 400 });

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return NextResponse.json({ ok: false, reason: 'no_template' }, { status: 404 });

  const tpl: any = t;
  if (localBusinessSchemaEnabled(tpl.data)) {
    return NextResponse.json({ ok: true, changed: false, reason: 'already' });
  }
  const built = buildLocalBusinessSchema(tpl.data ?? {});
  if (!built) return NextResponse.json({ ok: true, changed: false, reason: 'insufficient' });

  const nextData = { ...(tpl.data ?? {}), meta: { ...((tpl.data ?? {}).meta ?? {}), local_business_schema: true } };
  const payload = {
    id: templateId,
    base_rev: tpl.rev ?? 0,
    patch: { data: nextData },
    actor: operator.id ?? null,
    kind: 'save',
    org_id: null,
  };
  let err: any = null;
  {
    const { error } = await (supabaseAdmin as any).schema('public').rpc('commit_template_http', { p_payload: payload });
    err = error;
  }
  if (err) {
    const { error } = await (supabaseAdmin as any).schema('app').rpc('commit_template', { p_payload: payload });
    err = error;
  }
  if (err) return NextResponse.json({ ok: false, error: err.message || 'commit failed' }, { status: 502 });

  return NextResponse.json({ ok: true, changed: true, type: built['@type'] });
}
