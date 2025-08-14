import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReqBody = { mealId: string };

export async function POST(req: NextRequest) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { mealId } = (await req.json()) as ReqBody;
  if (!mealId) return NextResponse.json({ error: 'mealId required' }, { status: 400 });

  // Load the meal and owning merchant
  const { data: meal } = await supa
    .from('meals')
    .select('id, merchant_id, status')
    .eq('id', mealId).maybeSingle();
  if (!meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });

  const { data: prof } = await supa
    .from('merchant_compliance_profiles')
    .select('merchant_id, country, state, county, operation_type')
    .eq('merchant_id', meal.merchant_id).maybeSingle();

  if (!prof?.state || !prof.operation_type) {
    return NextResponse.json({ error: 'Compliance profile incomplete' }, { status: 400 });
  }

  // Active requirements for this scope (county-specific + state-level fallback)
  const { data: reqsCounty } = await supa
    .from('compliance_requirements')
    .select('id, code, required, details')
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type)
    .eq('active', true)
    .eq('juris_county', prof.county || null);

  const { data: reqsState } = await supa
    .from('compliance_requirements')
    .select('id, code, required, details')
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type)
    .eq('active', true)
    .is('juris_county', null);

  // Merge (county overrides state on same code)
  const byCode = new Map<string, any>();
  (reqsState || []).forEach(r => byCode.set(r.code, r));
  (reqsCounty || []).forEach(r => byCode.set(r.code, r));
  const reqs = Array.from(byCode.values()).filter(r => r.required);

  // Fetch latest approved doc per requirement
  const { data: docs } = await supa
    .from('compliance_docs')
    .select('id, requirement_id, status, issued_at, expires_at, kind')
    .eq('merchant_id', meal.merchant_id)
    .in('requirement_id', reqs.map(r => r.id));

  const now = new Date();
  const missing: string[] = [];
  const expired: string[] = [];
  const needsAI: string[] = [];

  for (const r of reqs) {
    const doc = (docs || []).find(d => d.requirement_id === r.id && d.status === 'approved');
    if (!doc) { missing.push(r.code); continue; }

    if (doc.expires_at && new Date(doc.expires_at) < now) {
      expired.push(r.code); continue;
    }

    // For insurance, enforce AI endorsement evidence (simple check by kind)
    if (r.code === 'INSURANCE_GPL' && r.details?.requires_ai_endorsement) {
      const hasEndorse = (docs || []).some(d => d.requirement_id === r.id && d.status === 'approved' && d.kind && d.kind.toUpperCase().includes('ENDORSE'));
      if (!hasEndorse) needsAI.push('INSURANCE_GPL');
    }
  }

  if (missing.length || expired.length || needsAI.length) {
    return NextResponse.json({
      error: 'Compliance requirements not satisfied',
      missing, expired, needsAI
    }, { status: 422 });
  }

  // Optional: enforce NY in-state sales at publish time (informational only here)
  const inStateOnly = reqs.find(r => r.code === 'NY_IN_STATE_ONLY');
  if (inStateOnly) {
    // You can also stamp a flag on the meal (e.g., ships_out_of_state=false)
    await supa.from('meals').update({ ships_out_of_state: false }).eq('id', meal.id);
  }

  // Finally publish
  const { error: upErr } = await supa.from('meals').update({ status: 'published' }).eq('id', meal.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
