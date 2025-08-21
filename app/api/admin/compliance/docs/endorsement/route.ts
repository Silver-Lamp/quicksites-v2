// app/api/admin/compliance/docs/endorsement/route.ts
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Build a server-side Supabase client wired to Next.js route-handler cookies. */
async function getSupabaseForRoute(): Promise<SupabaseClient<Database>> {
  const store = await nextCookies(); // ✅ sync in route handlers

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        // @supabase/ssr server interface: getAll / setAll
        getAll() {
          return store.getAll().map(({ name, value }: { name: string; value: string }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            // Next’s cookie store can be mutated in route handlers
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
}

async function assertAdmin() {
  const supa = await getSupabaseForRoute();

  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) return { code: 401 as const, error: 'Not signed in' };

  const { data: admin } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) return { code: 403 as const, error: 'Forbidden' };

  return { code: 200 as const, supa };
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) {
    return NextResponse.json({ error: gate.error }, { status: gate.code });
  }

  const supa = gate.supa as SupabaseClient<Database>;
  const { email, merchant_id, expires_in_days = 180 } = await req.json();

  // Resolve merchant
  let mid: string | undefined = merchant_id;
  if (!mid && email) {
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const u = list?.users?.find(
      (x) => x.email?.toLowerCase() === String(email).toLowerCase()
    );
    if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });

    const { data: m } = await supa
      .from('merchants')
      .select('id')
      .eq('user_id', u.id)
      .maybeSingle();

    if (!m) return NextResponse.json({ error: 'merchant not found for user' }, { status: 404 });
    mid = m.id;
  }

  if (!mid) {
    return NextResponse.json({ error: 'merchant_id or email required' }, { status: 400 });
  }

  // Find insurance requirement for merchant jurisdiction (county > state)
  const { data: prof } = await supa
    .from('merchant_compliance_profiles')
    .select('state, county, operation_type, country')
    .eq('merchant_id', mid)
    .maybeSingle();

  if (!prof) return NextResponse.json({ error: 'merchant profile not set' }, { status: 400 });

  const base = supa
    .from('compliance_requirements')
    .select('id, code, juris_county')
    .eq('active', true)
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type)
    .eq('code', 'INSURANCE_GPL');

  const { data: county } = await base.eq('juris_county', prof.county ?? null).maybeSingle();
  let reqRow = county;
  if (!reqRow) {
    const { data: state } = await base.is('juris_county', null).maybeSingle();
    reqRow = state || null;
  }
  if (!reqRow) {
    return NextResponse.json(
      { error: 'INSURANCE_GPL requirement not found' },
      { status: 404 }
    );
  }

  const expires = new Date(
    Date.now() + Math.max(1, Number(expires_in_days)) * 24 * 3600 * 1000
  ).toISOString();

  const row = {
    id: randomUUID(),
    merchant_id: mid,
    requirement_id: reqRow.id,
    status: 'approved',
    kind: 'AI ENDORSEMENT DOC',
    expires_at: expires,
    created_at: new Date().toISOString(),
  };

  const { error: insErr } = await supa.from('compliance_docs').insert(row);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  try {
    await supa.rpc('compliance_recompute_status', { p_merchant_id: mid });
  } catch {
    /* ignore */
  }

  const { data: snap } = await supa
    .from('compliance_status')
    .select('*')
    .eq('merchant_id', mid)
    .maybeSingle();

  return NextResponse.json({ ok: true, inserted: row, snapshot: snap });
}
