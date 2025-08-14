import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const mealId = url.searchParams.get('mealId');
  const status = url.searchParams.get('status') || 'active';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

  if (!mealId) return NextResponse.json({ error: 'mealId required' }, { status: 400 });

  // ownership: ensure the meal belongs to current merchant
  const { data: merchant } = await supabase.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  const { data: meal } = await supabase.from('meals').select('merchant_id').eq('id', mealId).maybeSingle();
  if (!merchant || !meal || meal.merchant_id !== merchant.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('waitlist_subscriptions')
    .select('id, email, status, created_at, notified_at')
    .eq('meal_id', mealId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subs: data ?? [] });
}
