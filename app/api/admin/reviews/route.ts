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

async function resolveMeal({ supa, meal_id, meal_slug, email }:{
  supa: ReturnType<typeof createRouteHandlerClient<Database>>;
  meal_id?: string; meal_slug?: string; email?: string;
}) {
  if (meal_id) {
    const { data } = await supa.from('meals').select('id, site_id, chef_id, title, slug').eq('id', meal_id).maybeSingle();
    return data;
  }
  if (meal_slug) {
    const { data } = await supa.from('meals').select('id, site_id, chef_id, title, slug').eq('slug', meal_slug).maybeSingle();
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
      .from('meals')
      .select('id, site_id, chef_id, title, slug')
      .eq('chef_id', chef.id as string)
      .order('created_at', { ascending: false })
      .maybeSingle();
    return meal ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa!;

  const { meal_id, meal_slug, email, count = 3 } = await req.json();
  const meal = await resolveMeal({ supa, meal_id, meal_slug, email });
  if (!meal) return NextResponse.json({ error: 'meal not found' }, { status: 404 });

  const comments = [
    'Absolutely delicious — will order again!',
    'Great flavors, portion could be larger.',
    'Loved the freshness and spice balance.',
    'Super tasty and arrived hot.',
    'Family favorite. 10/10.',
  ];
  const names = ['Tasha','Marco','Ari','Nina','Leo','Priya'];
  const rows = Array.from({ length: Math.max(1, Math.min(20, Number(count))) }, (_, i) => ({
    id: randomUUID(),
    meal_id: meal.id,
    chef_id: meal.chef_id,
    site_id: meal.site_id,
    rating: 3 + (i % 3), // 3..5
    comment: comments[(i + 1) % comments.length],
    user_name: names[(i * 2 + 3) % names.length],
    created_at: new Date().toISOString(),
  }));

  const { error } = await supa.from('reviews').insert(rows as any);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, meal: { id: meal.id, title: meal.title }, inserted: rows.length });
}
