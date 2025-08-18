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
  const supa = createServerClient<Database>(
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
  const { email, display_name } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // find auth user
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const u = list.users.find((x) => x.email?.toLowerCase() === String(email).toLowerCase());
  if (!u) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  // ensure merchant
  const { data: m } = await supa.from('merchants').select('id').eq('user_id', u.id).maybeSingle();
  const merchant_id = m?.id ?? randomUUID();
  if (!m) {
    const { error: ins } = await supa.from('merchants').insert({
      id: merchant_id, user_id: u.id, display_name: display_name || u.user_metadata?.name || 'Chef',
    } as any);
    if (ins) return NextResponse.json({ error: ins.message }, { status: 500 });
  }

  // ensure chef
  const { data: c } = await supa.from('chefs').select('id').eq('user_id', u.id).maybeSingle();
  const chef_id = c?.id ?? randomUUID();
  if (!c) {
    const { error: insC } = await supa.from('chefs').insert({
      id: chef_id, user_id: u.id, merchant_id, display_name: display_name || 'Chef',
    } as any);
    if (insC) return NextResponse.json({ error: insC.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_id: u.id, merchant_id, chef_id });
}
