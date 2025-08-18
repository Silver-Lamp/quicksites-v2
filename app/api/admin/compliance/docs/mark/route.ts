// app/api/admin/compliance/docs/mark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa };
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa!;

  const { email, merchant_id, code, status, expires_in_days = 180, kind } = await req.json();
  if (!code || !status) return NextResponse.json({ error: 'code and status required' }, { status: 400 });

  // resolve merchant
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

  // fetch merchant profile (for jurisdiction), then pick requirement (county over state)
  const { data: prof } = await supa.from('merchant_compliance_profiles')
    .select('state, county, operation_type, country').eq('merchant_id', mid).maybeSingle();
  if (!prof) return NextResponse.json({ error: 'merchant profile not set' }, { status: 400 });

  const baseSel = supa.from('compliance_requirements').select('id, code, juris_county')
    .eq('active', true)
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type)
    .eq('code', code);

  const { data: countyRow } = await baseSel.eq('juris_county', prof.county ?? null).maybeSingle();
  let requirement = countyRow;
  if (!requirement) {
    const { data: stateRow } = await baseSel.is('juris_county', null).maybeSingle();
    requirement = stateRow || null;
  }
  if (!requirement) return NextResponse.json({ error: 'requirement not found for jurisdiction' }, { status: 404 });

  // build doc row; "expired" is represented as approved with past expires_at
  const now = Date.now();
  const past = new Date(now - 24*3600*1000).toISOString();
  const future = new Date(now + Math.max(1, Number(expires_in_days)) * 24*3600*1000).toISOString();

  const row: any = {
    id: randomUUID(),
    merchant_id: mid,
    requirement_id: requirement.id,
    status: (status === 'expired') ? 'approved' : status,
    kind: kind ?? null,
    expires_at: (status === 'approved') ? future : (status === 'expired') ? past : null,
    created_at: new Date().toISOString(),
  };

  const { error: insErr } = await supa.from('compliance_docs').insert(row);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // recompute snapshot
  try { await supa.rpc('compliance_recompute_status', { p_merchant_id: mid }); } catch {}

  const { data: snap } = await supa.from('compliance_status').select('*').eq('merchant_id', mid).maybeSingle();
  return NextResponse.json({ ok: true, inserted: row, snapshot: snap });
}
