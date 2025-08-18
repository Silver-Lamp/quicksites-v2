import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { Database } from '@/types/supabase';

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
  const supa = gate.supa! as ReturnType<typeof createServerClient<Database>>;

  const { email, merchant_id, scenario = 'ok', valid_days = 180 } = await req.json();

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

  // profile + chosen requirements (county over state)
  const { data: prof } = await supa.from('merchant_compliance_profiles')
    .select('state, county, operation_type, country')
    .eq('merchant_id', mid).maybeSingle();
  if (!prof) return NextResponse.json({ error: 'merchant profile not set' }, { status: 400 });

  const { data: reqs } = await supa.from('compliance_requirements')
    .select('id, code, juris_county')
    .eq('active', true)
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type);

  if (!reqs?.length) return NextResponse.json({ ok: true, note: 'no requirements for jurisdiction' });

  // keep one per code (prefer county)
  const byCode = new Map<string, any>();
  for (const r of reqs) {
    const cur = byCode.get(r.code);
    if (!cur || (cur.juris_county == null && r.juris_county != null)) byCode.set(r.code, r);
  }
  const chosen = Array.from(byCode.values());

  const now = Date.now();
  const future = (days:number)=>new Date(now + days*24*3600*1000).toISOString();
  const past   = (days:number)=>new Date(now - days*24*3600*1000).toISOString();

  const rows: any[] = [];

  if (scenario === 'ok') {
    for (const r of chosen) {
      rows.push({
        id: randomUUID(),
        merchant_id: mid,
        requirement_id: r.id,
        status: 'approved',
        kind: r.code === 'INSURANCE_GPL' ? 'AI ENDORSEMENT DOC' : null,
        expires_at: future(valid_days),
        created_at: new Date().toISOString(),
      });
    }
  } else if (scenario === 'blocked') {
    let i = 0;
    for (const r of chosen) {
      if (i === 0) {
        // expired doc on first requirement
        rows.push({
          id: randomUUID(), merchant_id: mid, requirement_id: r.id,
          status: 'approved', kind: null, expires_at: past(10), created_at: new Date().toISOString(),
        });
      } else if (r.code === 'INSURANCE_GPL') {
        // approved without AI endorsement -> still blocked by your function
        rows.push({
          id: randomUUID(), merchant_id: mid, requirement_id: r.id,
          status: 'approved', kind: 'CERTIFICATE ONLY', expires_at: future(60), created_at: new Date().toISOString(),
        });
      } // else: leave missing
      i++;
    }
  } else {
    // mixed: one expiring soon, others valid; but insurance missing AI endorsement
    for (const r of chosen) {
      if (r.code === 'INSURANCE_GPL') {
        rows.push({
          id: randomUUID(), merchant_id: mid, requirement_id: r.id,
          status: 'approved', kind: 'CERTIFICATE ONLY', expires_at: future(15), created_at: new Date().toISOString(),
        });
      } else {
        rows.push({
          id: randomUUID(), merchant_id: mid, requirement_id: r.id,
          status: 'approved', kind: null, expires_at: future(valid_days), created_at: new Date().toISOString(),
        });
      }
    }
  }

  if (rows.length) {
    const { error: insErr } = await supa.from('compliance_docs').insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  try { await supa.rpc('compliance_recompute_status', { p_merchant_id: mid }); } catch {}
  const { data: snap } = await supa.from('compliance_status').select('*').eq('merchant_id', mid).maybeSingle();

  return NextResponse.json({ ok: true, inserted: rows.length, snapshot: snap });
}
