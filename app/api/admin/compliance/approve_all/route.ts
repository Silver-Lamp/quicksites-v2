import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa };
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa! as ReturnType<typeof createRouteHandlerClient<Database>>;

  const { email, merchant_id, valid_days = 365, include_ai_endorsement = true } = await req.json();

  // Resolve merchant
  let mid = merchant_id as string | undefined;
  if (!mid && email) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === String(email).toLowerCase());
    if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });
    const { data: m } = await supa.from('merchants').select('id').eq('user_id', u.id).maybeSingle();
    if (!m) return NextResponse.json({ error: 'merchant not found for user' }, { status: 404 });
    mid = m.id;
  }
  if (!mid) return NextResponse.json({ error: 'merchant_id or email required' }, { status: 400 });

  // Jurisdiction
  const { data: prof } = await supa.from('merchant_compliance_profiles')
    .select('state, county, operation_type, country').eq('merchant_id', mid).maybeSingle();
  if (!prof) return NextResponse.json({ error: 'merchant profile not set' }, { status: 400 });

  const { data: all } = await supa.from('compliance_requirements')
    .select('id, code, juris_county')
    .eq('active', true)
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type);

  if (!all?.length) return NextResponse.json({ ok: true, inserted: 0 });

  // pick county over state per code
  const byCode = new Map<string, any>();
  for (const r of all) {
    const cur = byCode.get(r.code);
    if (!cur || (cur.juris_county == null && r.juris_county != null)) byCode.set(r.code, r);
  }
  const chosen = Array.from(byCode.values());

  const expires = new Date(Date.now() + Math.max(1, Number(valid_days)) * 24 * 3600 * 1000).toISOString();
  const rows = chosen.map(r => ({
    id: randomUUID(),
    merchant_id: mid,
    requirement_id: r.id,
    status: 'approved',
    kind: r.code === 'INSURANCE_GPL' && include_ai_endorsement ? 'AI ENDORSEMENT DOC' : null,
    expires_at: expires,
    created_at: new Date().toISOString(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await supa.from('compliance_docs').insert(rows as any);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  try { await supa.rpc('compliance_recompute_status', { p_merchant_id: mid }); } catch {}
  const { data: snap } = await supa.from('compliance_status').select('*').eq('merchant_id', mid).maybeSingle();

  return NextResponse.json({ ok: true, inserted: rows.length, snapshot: snap });
}
