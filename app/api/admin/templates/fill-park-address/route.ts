// app/api/admin/templates/fill-park-address/route.ts
//
// One-click "Use an industrial park address" for the templates list / next-step button.
// Resolves a REAL industrial-park building (+ synthetic suite) for the site's city — lazily
// seeding the area from Google Places on first touch — writes it into the template's NAP, and
// commits through the sanctioned RPC (direct UPDATEs are trigger-blocked; see CLAUDE.md §8).
// Saves what the editor's "Use an industrial park address" tool would, without the 3 clicks.
//
// POST { templateId }
//   → { ok:true, changed:true, parkName, label }
//   → { ok:true, changed:false, reason:'no_parks'|'not_applicable' }
//   → { ok:false, reason:'disabled'|'no_city'|'no_template', error? }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveIndustryKey } from '@/lib/industries';
import { parksRegistryEnabled } from '@/lib/parks/registry';
import { resolveOfficeAddressFromRegistry } from '@/lib/parks/officeAddress';
import { applyOfficeAddressToData } from '@/lib/parks/applyOfficeAddressToTemplate';
import { deriveTemplateLocation } from '@/lib/geo/deriveTemplateLocation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Places Text Search on first touch for a metro

// Industrial-park addresses don't fit food sites (restaurants aren't in flex parks).
const FOOD_INDUSTRIES = new Set(['restaurant']);

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  if (!parksRegistryEnabled()) return NextResponse.json({ ok: false, reason: 'disabled' });

  const limited = await rateLimitOr429(req, 'templates-fill-park-address', 60, 3600);
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
    .select('id, slug, data, rev, city, state, industry')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return NextResponse.json({ ok: false, reason: 'no_template' }, { status: 404 });

  const tpl: any = t;
  const meta = tpl.data?.meta ?? {};
  const industryKey = resolveIndustryKey(tpl.industry || meta?.identity?.industry || meta?.industry || '');
  if (FOOD_INDUSTRIES.has(industryKey)) {
    return NextResponse.json({ ok: true, changed: false, reason: 'not_applicable' });
  }

  const loc = deriveTemplateLocation({ data: tpl.data, city: tpl.city, state: tpl.state });
  if (!loc.city) return NextResponse.json({ ok: false, reason: 'no_city' });

  let addr;
  try {
    addr = await resolveOfficeAddressFromRegistry(
      { domain: tpl.slug || templateId, city: loc.city, region: loc.state || null, industryKey },
      operator.id ?? null,
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Lookup failed.' }, { status: 502 });
  }
  if (!addr) return NextResponse.json({ ok: true, changed: false, reason: 'no_parks', city: loc.city, region: loc.state });

  // Write the NAP + commit through the sanctioned RPC (public.commit_template_http, with the
  // app.commit_template fallback) — same path lib/outreach/pointCampaignAddress.ts uses.
  const { data: newData, columns } = applyOfficeAddressToData(tpl.data ?? {}, addr);
  const payload = {
    id: templateId,
    base_rev: tpl.rev ?? 0,
    patch: { ...columns, data: newData },
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

  return NextResponse.json({ ok: true, changed: true, parkName: addr.parkName, label: addr.label });
}
