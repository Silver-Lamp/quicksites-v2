import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
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
  const { data: admin } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!admin) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa };
}

/**
 * Body:
 * {
 *   email?: string, merchant_id?: string,
 *   only_demo?: boolean = true,
 *   scope?: {
 *     reviews?: boolean, waitlist?: boolean, outbox?: boolean,
 *     invites?: boolean, meals?: boolean,
 *     compliance_docs?: boolean, compliance_profile?: boolean
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa! as ReturnType<typeof createServerClient<Database>>;

  const body = await req.json();
  const {
    email,
    merchant_id,
    only_demo = true,
    scope = {
      reviews: true, waitlist: true, outbox: true, invites: true,
      meals: true, compliance_docs: false, compliance_profile: false
    }
  } = body || {};

  // Resolve merchant_id from email if needed
  let mid: string | undefined = merchant_id;
  if (!mid && email) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!);
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === String(email).toLowerCase());
    if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });
    const { data: m } = await supa.from('merchants').select('id').eq('user_id', u.id).maybeSingle();
    if (!m) return NextResponse.json({ error: 'merchant not found for user' }, { status: 404 });
    mid = m.id;
  }
  if (!mid) return NextResponse.json({ error: 'merchant_id or email required' }, { status: 400 });

  // Nukes a merchant's generic commerce demo data. (The meals/reviews vertical
  // was removed; this now targets catalog_items + orders.)
  const r: Record<string, number> = {
    catalog_items: 0, orders: 0, compliance_docs: 0, compliance_status: 0, compliance_profile: 0,
  };

  // dynamic table name — cast to any (typed client requires literal table names); see types migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function del(table: string, filter: (b: any) => any, countKey: keyof typeof r) {
    const { data: ids } = await filter((supa as any).from(table).select('id'));
    const n = (ids ?? []).length;
    if (n) {
      const { error } = await filter((supa as any).from(table).delete());
      if (error) throw new Error(`${table} delete failed: ${error.message}`);
    }
    r[countKey] += n;
  }

  // Commerce demo data for this merchant (orders cascades order_items + payments).
  await del('catalog_items', (q: any) => q.eq('merchant_id', mid), 'catalog_items');
  await del('orders', (q: any) => q.eq('merchant_id', mid), 'orders');

  // Compliance (per merchant)
  if (scope.compliance_docs) {
    await del('compliance_docs', (q: any) => q.eq('merchant_id', mid), 'compliance_docs');
  }
  if (scope.compliance_profile) {
    await del('compliance_status', (q: any) => q.eq('merchant_id', mid), 'compliance_status');
    await del('merchant_compliance_profiles', (q: any) => q.eq('merchant_id', mid), 'compliance_profile');
  }

  return NextResponse.json({ ok: true, merchant_id: mid, deleted: r });
}
