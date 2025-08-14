import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Not signed in', { status: 401 });

  const url = new URL(req.url);
  const mealId = url.searchParams.get('mealId');
  const status = url.searchParams.get('status') || 'active';
  if (!mealId) return new NextResponse('mealId required', { status: 400 });

  const { data: merchant } = await supabase.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  const { data: meal } = await supabase.from('meals').select('merchant_id, title').eq('id', mealId).maybeSingle();
  if (!merchant || !meal || meal.merchant_id !== merchant.id) return new NextResponse('Forbidden', { status: 403 });

  const { data } = await supabase
    .from('waitlist_subscriptions')
    .select('email, status, created_at, notified_at')
    .eq('meal_id', mealId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  const rows = [['email','status','created_at','notified_at'], ...(data ?? []).map(s => [
    s.email, s.status, s.created_at, s.notified_at ?? ''
  ])];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="waitlist-${meal.title.replace(/\W+/g,'-')}.csv"`
    }
  });
}
