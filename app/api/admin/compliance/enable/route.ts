import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

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
  const supa = gate.supa!;

  const { email, state, county, operation_type = 'home_kitchen' } = await req.json();

  if (!email || !state) return NextResponse.json({ error: 'email and state required' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const u = list.users.find((x) => x.email?.toLowerCase() === String(email).toLowerCase());
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  const { data: m } = await supa.from('merchants').select('id').eq('user_id', u.id).maybeSingle();
  if (!m) return NextResponse.json({ error: 'merchant not found for user' }, { status: 404 });

  const up = {
    merchant_id: m.id,
    state,
    county: county ?? null,
    operation_type,
    country: 'US'
  };

  const { error: upErr } = await supa
    .from('merchant_compliance_profiles')
    .upsert(up as any, { onConflict: 'merchant_id' });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // recompute snapshot
  try {
    await supa.rpc('compliance_recompute_status', { p_merchant_id: m.id });
  } catch {}

  const { data: snap } = await supa.from('compliance_status').select('*').eq('merchant_id', m.id).maybeSingle();

  return NextResponse.json({ ok: true, merchant_id: m.id, profile: up, snapshot: snap });
}
