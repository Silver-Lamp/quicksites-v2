import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  // simple header auth so only your backend/webhooks can mint
  const key = req.headers.get('x-api-key');
  if (!key || key !== process.env.REVIEWS_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const meal_id: string = body.meal_id;
  const order_id: string | null = body.order_id ?? null; // optional
  const user_email: string | null = body.user_email ?? null; // optional (for emailing a link)
  const days_valid: number = Number(body.days_valid ?? 30);

  if (!meal_id) return NextResponse.json({ error: 'meal_id required' }, { status: 400 });

  // lookup chef/site from the meal for convenience
  const { data: meal } = await svc
    .from('meals')
    .select('id, chef_id, site_id, title')
    .eq('id', meal_id)
    .maybeSingle();
  if (!meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });

  // random token (DB-backed so we can revoke/consume reliably)
  const token = (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '');
  const expires_at = new Date(Date.now() + days_valid * 24 * 3600 * 1000).toISOString();

  const { error: insErr } = await svc.from('review_tokens').insert({
    token,
    meal_id: meal.id,
    chef_id: meal.chef_id,
    site_id: meal.site_id,
    order_id,
    user_email,
    expires_at
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const link = `${process.env.APP_BASE_URL}/reviews/start?token=${token}`;
  return NextResponse.json({ ok: true, token, link, meal: { id: meal.id, title: meal.title } });
}
