// app/api/admin/users/list/route.ts
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

  // 0) Plans — prefer user_plans if present; else try Stripe-like tables
  const planByUser = new Map<string, any>();
  try {
    const { data: ups, error: e } = await (admin as any)
      .from('user_plans')
      .select('user_id, plan, status, price_id, current_period_end, cancel_at, trial_end, updated_at')
      .in('user_id', userIds);
    if (!e) {
      (ups ?? []).forEach((p: any) => {
        if (p?.user_id) planByUser.set(p.user_id, { source: 'user_plans', ...p, label: p.plan });
      });
    }
  } catch {}

  const stillMissing = userIds.filter((id) => !planByUser.has(id));
  if (stillMissing.length) {
    const subTables = [
      { name: 'subscriptions', fields: 'user_id, status, price_id, current_period_end, cancel_at, trial_end, updated_at' },
      { name: 'billing_subscriptions', fields: 'user_id, status, price_id, current_period_end, cancel_at, trial_end, updated_at' },
      { name: 'stripe_subscriptions', fields: 'user_id, status, price_id, current_period_end, cancel_at, trial_end, updated_at' },
    ];
    for (const t of subTables) {
      const missingNow = userIds.filter((id) => !planByUser.has(id));
      if (!missingNow.length) break;
      try {
        const { data: subs, error: e } = await (admin as any)
          .from(t.name)
          .select(t.fields)
          .in('user_id', missingNow);
        if (!e) {
          (subs ?? []).forEach((s: any) => {
            if (s?.user_id && !planByUser.has(s.user_id)) {
              planByUser.set(s.user_id, { source: t.name, ...s });
            }
          });
        }
      } catch {}
    }

    // Enrich with price nickname/lookup_key/product name where possible
    const priceIds = Array.from(planByUser.values())
      .map((p: any) => p?.price_id)
      .filter(Boolean);
    let priceById = new Map<string, any>();
    try {
      const { data: prices } = await (admin as any)
        .from('prices')
        .select('id, nickname, lookup_key, product_id')
        .in('id', priceIds);
      priceById = new Map((prices ?? []).map((p: any) => [p.id, p]));
    } catch {}

    let productById = new Map<string, any>();
    try {
      const { data: products } = await (admin as any)
        .from('products')
        .select('id, name');
      productById = new Map((products ?? []).map((p: any) => [p.id, p]));
    } catch {}

    for (const [uid, p] of Array.from(planByUser.entries())) {
      if (p.source === 'user_plans') continue; // already labeled
      const price = p?.price_id ? priceById.get(p.price_id) : null;
      const product = price?.product_id ? productById.get(price.product_id) : null;
      const label = price?.nickname ?? price?.lookup_key ?? product?.name ?? null;
      planByUser.set(uid, { ...p, plan: label ?? null, label });
    }
  }

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

    const plan = planByUser.get(u.id) ?? null;

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
      plan: plan && {
        source: plan.source ?? 'unknown',
        key: plan.plan ?? plan.label ?? null,
        label: plan.label ?? plan.plan ?? null,
        status: plan.status ?? null,
        price_id: plan.price_id ?? null,
        current_period_end: plan.current_period_end ?? null,
        cancel_at: plan.cancel_at ?? null,
        trial_end: plan.trial_end ?? null,
        updated_at: plan.updated_at ?? null,
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