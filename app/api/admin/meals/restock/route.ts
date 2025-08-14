import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { restockTemplate, buildMealUrl } from '@/lib/email';
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
    const { data } = await supa.from('meals').select('id, site_id, chef_id, merchant_id, title, slug, qty_available, is_active').eq('id', meal_id).maybeSingle();
    return data;
  }
  if (meal_slug) {
    const { data } = await supa.from('meals').select('id, site_id, chef_id, merchant_id, title, slug, qty_available, is_active').eq('slug', meal_slug).maybeSingle();
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
      .select('id, site_id, chef_id, merchant_id, title, slug, qty_available, is_active')
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
  const supa = gate.supa!;

  const { meal_id, meal_slug, email, qty, is_active = true } = await req.json();
  if (qty == null || Number(qty) < 0) return NextResponse.json({ error: 'qty must be >= 0' }, { status: 400 });

  const meal = await resolveMeal({ supa, meal_id, meal_slug, email });
  if (!meal) return NextResponse.json({ error: 'meal not found' }, { status: 404 });

  // Update qty / active
  const { data: updated, error: upErr } = await supa
    .from('meals')
    .update({ qty_available: Number(qty), is_active: Boolean(is_active) } as any)
    .eq('id', meal.id)
    .select('id, title, slug, qty_available, is_active')
    .maybeSingle();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // enqueue waitlist if sellable
  let queued = 0;
  if (updated && updated.is_active && Number(updated.qty_available) > 0) {
    const { data: subs } = await supa
      .from('waitlist_subscriptions')
      .select('id, email, token')
      .eq('meal_id', meal.id)
      .eq('status', 'active');

    if (subs?.length) {
      const baseUrl = process.env.APP_BASE_URL || '';
      const mealUrl = buildMealUrl({ id: meal.id, slug: meal.slug ?? undefined, baseUrl });
      const rows = subs.map(s => ({
        subscription_id: s.id,
        meal_id: meal.id,
        to_email: s.email,
        subject: `${meal.title} is back in stock`,
        html: restockTemplate({
          mealTitle: meal.title,
          mealUrl,
          unsubscribeUrl: `${baseUrl}/unsubscribe?token=${s.token}`,
          siteName: 'delivered.menu'
        }),
        status: 'pending',
      }));
      const { error: insErr } = await supa.from('email_outbox').insert(rows as any);
      if (!insErr) {
        queued = rows.length;
        await supa.from('waitlist_subscriptions').update({ status: 'queued' }).eq('meal_id', meal.id).eq('status', 'active');
      }
    }
  }

  return NextResponse.json({ ok: true, meal: updated, queued });
}
