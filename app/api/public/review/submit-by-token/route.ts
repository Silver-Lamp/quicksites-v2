// /app/api/public/review/submit-by-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { codeGen } from '@/lib/coupons';

export const runtime='nodejs'; export const dynamic='force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const { token, orderItemId, rating, comment } = await req.json();
  if (!token || !orderItemId || !rating) return NextResponse.json({ error:'Missing fields' }, { status:400 });

  // Resolve order + item
  const { data: o } = await db.from('orders')
    .select('id, user_id, merchant_id, review_token_expires')
    .eq('review_token', token).maybeSingle();
  if (!o) return NextResponse.json({ error:'invalid' }, { status:404 });
  if (o.review_token_expires && new Date(o.review_token_expires) < new Date())
    return NextResponse.json({ error:'expired' }, { status:410 });

  const { data: it } = await db.from('order_items')
    .select('id, meal_id, meals ( slug )')
    .eq('id', orderItemId)
    .eq('order_id', o.id)
    .maybeSingle();
  if (!it) return NextResponse.json({ error:'Item not in order' }, { status:400 });

  // Upsert review (verified)
  const payload = {
    order_id: o.id,
    order_item_id: it.id,
    meal_id: it.meal_id,
    merchant_id: o.merchant_id,
    user_id: o.user_id,                 // verified to the order’s user
    rating: Math.max(1, Math.min(5, Number(rating))),
    comment: comment?.slice(0,2000) || null,
    status: 'published',
    is_verified: true
  };

  const { data: existing } = await db
    .from('reviews').select('id').eq('order_item_id', it.id).eq('user_id', o.user_id).maybeSingle();

  if (existing) await db.from('reviews').update(payload).eq('id', existing.id);
  else await db.from('reviews').insert(payload);

  await db.from('review_token_events').insert({ token, order_id: o.id, order_item_id: it.id, action:'submit' });

  // Update meal aggregates (quick way; you can move to triggers)
  const { data: stats } = await db.from('reviews')
    .select('rating').eq('meal_id', it.meal_id).eq('status','published');
  const arr = (stats||[]).map(r=>r.rating);
  const avg = arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : null;
  await db.from('meals').update({
    rating_avg: avg ? Number(avg.toFixed(2)) : null,
    rating_count: arr.length
  }).eq('id', it.meal_id);


  const { data: merch } = await db.from('merchants')
  .select('id, review_incentive_enabled, review_incentive_percent, review_incentive_min_subtotal_cents, review_incentive_expires_days, review_incentive_prefix')
  .eq('id', o.merchant_id).maybeSingle();

let issuedCode: string | null = null;

if (merch?.review_incentive_enabled && merch.review_incentive_percent && o?.user_id) {
  const ownerId = o.user_id;

  // Do they already have an active coupon from this merchant?
  const { data: existing } = await db.from('coupons')
    .select('id').eq('merchant_id', merch.id).eq('user_id', ownerId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  if (!existing?.length) {
    let code = codeGen(merch.review_incentive_prefix || 'DM');
    for (let i=0;i<6;i++) {
      const { data: clash } = await db.from('coupons').select('id').eq('code', code).maybeSingle();
      if (!clash) break; code = codeGen(merch.review_incentive_prefix || 'DM');
    }
    const expires = new Date(Date.now() + (merch.review_incentive_expires_days || 30) * 24 * 3600 * 1000).toISOString();
    const ins = await db.from('coupons').insert({
      merchant_id: merch.id,
      user_id: ownerId,
      review_id: /* current review id if available */ null,
      code,
      type: 'percent',
      percent: merch.review_incentive_percent,
      min_subtotal_cents: merch.review_incentive_min_subtotal_cents || 0,
      expires_at: expires,
      uses_allowed: 1,
      status: 'active'
    }).select('code').single();
    issuedCode = ins.data?.code || null;

    // (Optional) enqueue an email with the code
    try {
    await db.from('email_outbox').insert({
      to_user_id: ownerId,
      subject: 'Thanks for your review — here’s 10% off your next order',
        html: `<p>Use code <b>${issuedCode}</b> for ${merch.review_incentive_percent}% off your next ${process.env.APP_BRAND || 'delivered.menu'} order with this chef.</p>
               <p>Expires in ${(merch.review_incentive_expires_days || 30)} days. Min subtotal: $${((merch.review_incentive_min_subtotal_cents||0)/100).toFixed(2)}.</p>`
      });
    } catch {}
  }
}


    return NextResponse.json({ ok:true, verified: true, couponCode: issuedCode, mealHandle: (it.meals[0]?.slug || it.meal_id) });
}
