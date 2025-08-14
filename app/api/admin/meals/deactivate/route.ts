import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
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

async function resolveMeal({ supa, meal_id, meal_slug, email }:{
  supa: ReturnType<typeof createRouteHandlerClient<Database>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meal_id?: string; meal_slug?: string; email?: string;
}) {
  if (meal_id) {
    const { data } = await supa.from('meals').select('id, chef_id, title, slug, qty_available, is_active').eq('id', meal_id).maybeSingle();
    return data;
  }
  if (meal_slug) {
    const { data } = await supa.from('meals').select('id, chef_id, title, slug, qty_available, is_active').eq('slug', meal_slug).maybeSingle();
    return data;
  }
  if (email) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === email.toLowerCase());
    if (!u) return null;
    const { data: chef } = await supa.from('chefs').select('id').eq('user_id', u.id).maybeSingle();
    if (!chef) return null;
    const { data: meal } = await supa
      .from('meals').select('id, chef_id, title, slug, qty_available, is_active')
      .eq('chef_id', chef.id)
      .order('created_at', { ascending: false })
      .maybeSingle();
    return meal ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa! as ReturnType<typeof createRouteHandlerClient<Database>>;

  const { meal_id, meal_slug, email, qty } = await req.json();
  const meal = await resolveMeal({ supa, meal_id, meal_slug, email });
  if (!meal) return NextResponse.json({ error: 'meal not found' }, { status: 404 });

  const patch: any = { is_active: false };
  if (qty != null) patch.qty_available = Number(qty);

  const { data: updated, error: upErr } = await supa
    .from('meals')
    .update(patch)
    .eq('id', meal.id)
    .select('id, title, slug, qty_available, is_active')
    .maybeSingle();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, meal: updated });
}
