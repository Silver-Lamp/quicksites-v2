import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime='nodejs'; export const dynamic='force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();

  const { code, mealId, rating, comment, email } = await req.json();
  if (!code || !mealId || !rating) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  // Resolve merchant
  const { data: merchant } = await db.from('merchants').select('id').eq('review_code', code).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });

  // Try to verify purchase:
  let verified = false;
  let orderItemId: string | null = null;
  let orderId: string | null = null;
  let userId: string | null = user?.id || null;

  if (user) {
    const { data: hit } = await supa
      .from('order_items')
      .select('id, order_id')
      .eq('meal_id', mealId).limit(1)
      .in('order_id', supa.from('orders').select('id').eq('user_id', user.id).eq('merchant_id', merchant.id) as any);
    if (hit && hit[0]) {
      verified = true; orderItemId = hit[0].id; orderId = hit[0].order_id;
    }
  } else if (email) {
    const { data: ord } = await db
      .from('orders')
      .select('id, user_id')
      .eq('merchant_id', merchant.id)
      .eq('email', email.toLowerCase())
      .gte('created_at', new Date(Date.now() - 60*24*3600e3).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (ord && ord[0]) {
      userId = ord[0].user_id || null; orderId = ord[0].id;
      const { data: item } = await db.from('order_items').select('id').eq('order_id', orderId).eq('meal_id', mealId).maybeSingle();
      if (item) { verified = true; orderItemId = item.id; }
    }
  }

  if (!userId) {
    // create a minimal shadow user-less review? attach null user_id if your schema allows
    // For now, require some identity:
    return NextResponse.json({ error: 'Please sign in or provide email' }, { status: 400 });
  }

  // Insert or upsert a review (if we have an order item + user)
  const reviewRow: any = {
    order_id: orderId,
    order_item_id: orderItemId,
    meal_id: mealId,
    merchant_id: merchant.id,
    user_id: userId,
    rating: Math.max(1, Math.min(5, Number(rating))),
    comment: comment?.slice(0, 2000) || null,
    status: verified ? 'published' : 'pending',
    is_verified: verified
  };

  await db.from('reviews').insert(reviewRow);

  // Recompute meal aggregates (optional; you can move to trigger)
  const { data: stats } = await db.from('reviews').select('rating').eq('meal_id', mealId).eq('status','published');
  const ratings = (stats||[]).map(r=>r.rating);
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;
  await db.from('meals').update({ rating_avg: avg ? Number(avg.toFixed(2)) : null, rating_count: ratings.length }).eq('id', mealId);

  return NextResponse.json({ ok: true, verified });
}
