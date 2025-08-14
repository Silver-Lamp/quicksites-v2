// /app/api/orders/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { orderItemId, rating, comment, photos } = await req.json();
  if (!orderItemId || !rating) return NextResponse.json({ error: 'orderItemId & rating required' }, { status: 400 });

  // Verify the order item belongs to this user and is for a meal
  const { data: item } = await supa
    .from('order_items')
    .select('id, order_id, meal_id, orders!inner(user_id, merchant_id, payment_provider, stripe_payment_intent_id, square_payment_id, status, delivered_at)')
    .eq('id', orderItemId)
    .maybeSingle();

  if (!item || item.orders[0].user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Optional: only allow reviews after delivered
  // if (!item.orders.delivered_at) return NextResponse.json({ error: 'Not delivered yet' }, { status: 400 });

  // Upsert review
  const payload = {
    order_id: item.order_id,
    order_item_id: orderItemId,
    meal_id: item.meal_id,
    merchant_id: item.orders[0].merchant_id,
    user_id: user.id,
    rating: Math.max(1, Math.min(5, Number(rating))),
    comment: comment?.slice(0, 2000) || null,
    photos: Array.isArray(photos) ? photos.slice(0, 6) : null,
    status: 'published'
  };

  const { data: existing } = await supa
    .from('reviews')
    .select('id')
    .eq('order_item_id', orderItemId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supa.from('reviews').update(payload).eq('id', existing.id);
  } else {
    await supa.from('reviews').insert(payload);
  }

  // Recompute simple aggregates (can be a trigger in SQL if you prefer)
  const { data: stats } = await supa
    .from('reviews')
    .select('rating')
    .eq('meal_id', item.meal_id)
    .eq('status', 'published');

  const ratings = (stats || []).map(r => r.rating);
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;

  await supa.from('meals').update({
    rating_avg: avg ? Number(avg.toFixed(2)) : null,
    rating_count: ratings.length
  }).eq('id', item.meal_id);

  return NextResponse.json({ ok: true });
}
