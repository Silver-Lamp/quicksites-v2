import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProvider } from '@/lib/payments';
import { computeDiscount } from '@/lib/coupons';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const supa = createRouteHandlerClient({ cookies });
const { data: { user } } = await supa.auth.getUser();
const userId = user?.id;

// assume body.shippingAddress like { country:'US', state:'NY', ... }
// const ship = shippingAddress || {};
// const shipState = String(ship.state || '').toUpperCase();

async function merchantHasReqCode(merchantId: string, code: string) {
  // load profile
  const { data: prof } = await supa
    .from('merchant_compliance_profiles')
    .select('country, state, county, operation_type')
    .eq('merchant_id', merchantId).maybeSingle();
  if (!prof) return false;

  // county override + state fallback
  const { data: reqsCounty } = await supa.from('compliance_requirements')
    .select('code').eq('active', true)
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type)
    .eq('juris_county', prof.county || null);

  const { data: reqsState } = await supa.from('compliance_requirements')
    .select('code').eq('active', true)
    .eq('juris_country', prof.country || 'US')
    .eq('juris_state', prof.state)
    .eq('operation_type', prof.operation_type)
    .is('juris_county', null);

  const codes = new Set<string>([...(reqsState||[]).map(r=>r.code), ...(reqsCounty||[]).map(r=>r.code)]);
  return codes.has(code);
}

export async function POST(req: NextRequest) {
  try {
    const { mealId, quantity = 1, couponCode } = await req.json();
    if (!mealId || quantity <= 0) return NextResponse.json({ error: 'mealId and positive quantity required' }, { status: 400 });

    // if (await merchantHasReqCode(merchantId, 'NY_IN_STATE_ONLY')) {
    //   if (ship.country && ship.country !== 'US') {
    //     return NextResponse.json({ error: 'This chef can ship within New York State only.' }, { status: 422 });
    //   }
    //     if (shipState !== 'NY') {
    //       return NextResponse.json({ error: 'This chef can ship within New York State only.' }, { status: 422 });
    //     }
    // }

    // 1) Lookup meal + merchant + site
    const { data: meal, error: eMeal } = await db
      .from('meals')
      .select('id, site_id, merchant_id, title, price_cents, is_active, available_from, available_to')
      .eq('id', mealId)
      .single();
    if (eMeal || !meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    if (!meal.is_active) return NextResponse.json({ error: 'Meal inactive' }, { status: 400 });

    // Optional: window guard
    const now = new Date();
    if ((meal.available_from && now < new Date(meal.available_from)) || (meal.available_to && now > new Date(meal.available_to))) {
      return NextResponse.json({ error: 'Meal not currently available' }, { status: 400 });
    }

    // 2) Get merchant, account, and platform fee
    const { data: merchant } = await db.from('merchants').select('*').eq('id', meal.merchant_id).single();
    const { data: acct } = await db.from('merchant_payment_accounts').select('*').eq('merchant_id', merchant.id).eq('provider', merchant.provider).maybeSingle();

    let applicationFeeBps = merchant.default_platform_fee_bps;
    const { data: site } = await db.from('sites').select('platform_fee_bps').eq('id', meal.site_id).maybeSingle();
    if (site?.platform_fee_bps != null) applicationFeeBps = site.platform_fee_bps;

    const amountCents = meal.price_cents * quantity;

    let couponId: string | null = null;
    let discountCents = 0;
    
    if (couponCode) {
      const { data: c } = await db.from('coupons').select('*')
        .eq('code', couponCode)
        .eq('merchant_id', meal.merchant_id)
        .maybeSingle();
    
      if (c) {
        // 🔐 hard check: if tied to a user, it must be THIS user
        if (c.user_id && (!user || user.id !== c.user_id)) {
          return NextResponse.json({ error: 'Coupon not available for this account' }, { status: 403 });
        }
        const maybe = computeDiscount(amountCents, c as any);
        if (maybe > 0) { discountCents = maybe; couponId = c.id; }
      }
    }
    
    // Final totals (no stacking with any other code)
    const totalCents = Math.max(0, amountCents - discountCents);

    const urlUtm = new URL(req.headers.get('referer') || process.env.APP_BASE_URL!);
    const utm = {
      utm_source: urlUtm.searchParams.get('utm_source') || req.cookies.get('utm_source')?.value || null,
      utm_medium: urlUtm.searchParams.get('utm_medium') || req.cookies.get('utm_medium')?.value || null,
      utm_campaign: urlUtm.searchParams.get('utm_campaign') || req.cookies.get('utm_campaign')?.value || null,
      utm_content: urlUtm.searchParams.get('utm_content') || req.cookies.get('utm_content')?.value || null,
      ref: urlUtm.searchParams.get('ref') || req.cookies.get('ref')?.value || null,
    };

    // 3) Create order + item
    const { data: order, error: eOrder } = await db.from('orders').insert({
      site_id: meal.site_id,
      merchant_id: meal.merchant_id,
      coupon_id: couponId,
      currency: 'usd',
      subtotal_cents: amountCents,
      discount_cents: discountCents,
      amount_cents: totalCents,
      ...utm,
    }).select('*').single();
    if (eOrder) return NextResponse.json({ error: eOrder.message }, { status: 500 });

    const eItem = await db.from('order_items').insert({
      order_id: order.id,
      merchant_id: meal.merchant_id,
      meal_id: meal.id,
      title: meal.title,
      quantity,
      unit_price_cents: meal.price_cents
    });
    if (eItem.error) return NextResponse.json({ error: eItem.error.message }, { status: 500 });

    // 4) Stripe Checkout (direct charge → seller; your platform fee applied)
    const provider = getProvider('stripe');
    const successUrl = `${process.env.APP_BASE_URL}/checkout/success`;
    const cancelUrl  = `${process.env.APP_BASE_URL}/checkout/cancel`;

    const { url } = await provider.createCheckout({
      orderId: order.id,
      amountCents: totalCents,
      currency: 'usd',
      successUrl,
      cancelUrl,
      connectedAccountId: acct?.provider_account_id ?? undefined,
      applicationFeeBps
    });

    // mark coupon as used, and record redemption
    if (order.coupon_id && order.discount_cents > 0) {
      const { data: consumed, error: rpcErr } = await db.rpc('coupon_consume', { p_coupon_id: order.coupon_id });
      if (!rpcErr && consumed === true) {
        await db.from('coupon_redemptions').insert({
          coupon_id: order.coupon_id,
          order_id: order.id,
          user_id: order.user_id,
          merchant_id: order.merchant_id,
          amount_cents_applied: order.discount_cents
        });
      } // else: already used/expired/race lost — no double dipping
    }
    
    return NextResponse.json({ url, orderId: order.id });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
