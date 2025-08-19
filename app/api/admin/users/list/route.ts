import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach(c => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );
  const { data: auth } = await (supa as AnyClient).auth.getUser();
  if (!auth.user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await (supa as AnyClient)
    .from('admin_users').select('user_id').eq('user_id', auth.user.id).limit(1);
  if (!admin?.[0]) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa: supa as AnyClient };
}

export async function GET(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as AnyClient;

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const perPage = Math.min(Math.max(Number(searchParams.get('perPage') ?? '50'), 1), 200);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  // 1) auth users
  const { data: lu, error } = await (admin as any).auth.admin.listUsers({ page, perPage });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users: Array<any> = lu.users ?? [];

  const filtered = q
    ? users.filter((u) =>
        (u.email ?? '').toLowerCase().includes(q) ||
        String((u.user_metadata as any)?.name ?? '').toLowerCase().includes(q)
      )
    : users;

  const userIds = filtered.map(u => u.id);

  // 2) tables (tolerate schema drift)
  const { data: chefs = [] } = await (admin as any)
    .from('chefs')
    .select('id, user_id, merchant_id, name, display_name, location, bio, profile_image_url')
    .in('user_id', userIds);

  const { data: merchants = [] } = await (admin as any)
    .from('merchants')
    .select('id, user_id, name, display_name')
    .in('user_id', userIds);

  const chefByUser = new Map<string, any>();
  chefs.forEach((c: any) => c?.user_id && chefByUser.set(c.user_id, c));

  const merchByUser = new Map<string, any>();
  const merchantIds: string[] = [];
  merchants.forEach((m: any) => {
    if (m?.user_id) merchByUser.set(m.user_id, m);
    if (m?.id) merchantIds.push(m.id);
  });

  // 3) compliance profile
  let profiles: any[] = [];
  try {
    const { data } = await (admin as any)
      .from('compliance_profiles')
      .select('merchant_id, state, county, operation_type, country')
      .in('merchant_id', merchantIds);
    profiles = data ?? [];
  } catch { /* table may not exist */ }
  const profileByMerchant = new Map<string, any>();
  profiles.forEach((p) => p?.merchant_id && profileByMerchant.set(p.merchant_id, p));

  // 4) latest compliance snapshot (try a few likely table names)
  const snapshotTables = [
    'compliance_snapshots',
    'compliance_snapshot',
    'compliance_status_snapshots',
    'compliance_status',
  ];
  let snapshots: any[] = [];
  for (const t of snapshotTables) {
    try {
      const { data, error: e } = await (admin as any)
        .from(t)
        .select('merchant_id, overall, missing, expiring, updated_at')
        .in('merchant_id', merchantIds)
        .order('updated_at', { ascending: false });
      if (!e) { snapshots = data ?? []; break; }
    } catch { /* try next */ }
  }
  const latestByMerchant = new Map<string, any>();
  for (const s of snapshots) {
    if (s?.merchant_id && !latestByMerchant.has(s.merchant_id)) {
      latestByMerchant.set(s.merchant_id, s);
    }
  }

  // 5) shape response
  const rows = filtered.map((u) => {
    const chef = chefByUser.get(u.id) ?? null;
    const merch = merchByUser.get(u.id) ?? null;
    const prof = merch ? (profileByMerchant.get(merch.id) ?? null) : null;
    const snap = merch ? (latestByMerchant.get(merch.id) ?? null) : null;
    const overall =
      snap?.overall ??
      (prof ? 'pending' : 'none');

    return {
      id: u.id,
      email: u.email,
      name: (u.user_metadata as any)?.name ?? null,
      is_chef: !!chef,
      chef: chef && {
        id: chef.id,
        display_name: chef.display_name ?? chef.name ?? null,
        name: chef.name ?? null,
        location: chef.location ?? null,
        bio: chef.bio ?? null,
        profile_image_url: chef.profile_image_url ?? null,
        merchant_id: chef.merchant_id ?? null,
      },
      merchant: merch && {
        id: merch.id,
        name: merch.display_name ?? merch.name ?? null,
      },
      compliance: merch && {
        profile: prof,
        snapshot: snap,
        overall,
      },
    };
  });

  return NextResponse.json({
    ok: true,
    page,
    perPage,
    count: rows.length,
    hasMore: rows.length === perPage,
    users: rows,
  });
}
