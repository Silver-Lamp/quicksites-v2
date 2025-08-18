// app/api/public/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';
import { getProvider } from '@/lib/payments';
import { computeDiscount } from '@/lib/coupons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Service-role client for DB reads/writes
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { mealId, quantity = 1, couponCode } = await req.json();

    if (!mealId || typeof mealId !== 'string') {
      return NextResponse.json({ error: 'mealId required' }, { status: 400 });
    }
    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      return NextResponse.json({ error: 'quantity must be > 0' }, { status: 400 });
    } 

    // Auth user (needed for user-locked coupons)
    const store = await cookies();
    const supa = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieEncoding: 'base64url',
        cookies: {
          getAll() {
            return store.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookies) {
            for (const c of cookies) {
              store.set(c.name, c.value, c.options as CookieOptions | undefined);
            }
          },
        },
      }
    );
    const { data: { user } } = await supa.auth.getUser();
    const userId = user?.id ?? null;

    // 1) Meal lookup + availability checks
    const { data: meal, error: eMeal } = await db
      .from('meals')
      .select('id, site_id, merchant_id, title, price_cents, is_active, available_from, available_to')
      .eq('id', mealId)
      .single();

    if (eMeal || !meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    if (!meal.is_active) return NextResponse.json({ error: 'Meal inactive' }, { status: 400 });

    const now = new Date();
    if (
      (meal.available_from && now < new Date(meal.available_from)) ||
      (meal.available_to && now > new Date(meal.available_to))
    ) {
      return NextResponse.json({ error: 'Meal not currently available' }, { status: 400 });
    }

    // 2) Merchant + account + fee
    const { data: merchant, error: eMerch } = await db
      .from('merchants')
      .select('*')
      .eq('id', meal.merchant_id)
      .single();
    if (eMerch || !merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const { data: acct } = await db
      .from('merchant_payment_accounts')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('provider', merchant.provider)
      .maybeSingle();

    let applicationFeeBps = merchant.default_platform_fee_bps;
    const { data: site } = await db
      .from('sites')
      .select('platform_fee_bps')
      .eq('id', meal.site_id)
      .maybeSingle();
    if (site?.platform_fee_bps != null) applicationFeeBps = site.platform_fee_bps;

    const amountCents = meal.price_cents * qty;

    // 3) Coupon (optional)
    let couponId: string | null = null;
    let discountCents = 0;

    if (couponCode) {
      const { data: c } = await db
        .from('coupons')
        .select('*')
        .eq('code', couponCode)
        .eq('merchant_id', meal.merchant_id)
        .maybeSingle();

      if (c) {
        // If coupon is user-specific, ensure it matches the current user
        if (c.user_id && (!user || user.id !== c.user_id)) {
          return NextResponse.json({ error: 'Coupon not available for this account' }, { status: 403 });
        }
        const maybe = computeDiscount(amountCents, c as any);
        if (maybe > 0) {
          discountCents = maybe;
          couponId = c.id;
        }
      }
    }

    const totalCents = Math.max(0, amountCents - discountCents);

    // 4) UTM/ref tracking – from Referer first, then cookie store
    const referer = req.headers.get('referer') || process.env.APP_BASE_URL!;
    const urlUtm = new URL(referer);
    const cookie = (n: string) => store.get(n)?.value || null;

    const utm = {
      utm_source: urlUtm.searchParams.get('utm_source') || cookie('utm_source'),
      utm_medium: urlUtm.searchParams.get('utm_medium') || cookie('utm_medium'),
      utm_campaign: urlUtm.searchParams.get('utm_campaign') || cookie('utm_campaign'),
      utm_content: urlUtm.searchParams.get('utm_content') || cookie('utm_content'),
      ref: urlUtm.searchParams.get('ref') || cookie('ref'),
    };

    // 5) Create order + item
    const { data: order, error: eOrder } = await db
      .from('orders')
      .insert({
        site_id: meal.site_id,
        merchant_id: meal.merchant_id,
        user_id: userId,
        coupon_id: couponId,
        currency: 'usd',
        subtotal_cents: amountCents,
        discount_cents: discountCents,
        amount_cents: totalCents,
        ...utm,
      })
      .select('*')
      .single();
    if (eOrder || !order) {
      return NextResponse.json({ error: eOrder?.message || 'Order create failed' }, { status: 500 });
    }

    const { error: eItem } = await db.from('order_items').insert({
      order_id: order.id,
      merchant_id: meal.merchant_id,
      meal_id: meal.id,
      title: meal.title,
      quantity: qty,
      unit_price_cents: meal.price_cents,
    });
    if (eItem) return NextResponse.json({ error: eItem.message }, { status: 500 });

    // 6) Create Stripe Checkout
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
      applicationFeeBps,
    });

    // 7) Mark coupon consumed (if applicable)
    if (order.coupon_id && order.discount_cents > 0) {
      const { data: consumed, error: rpcErr } = await db.rpc('coupon_consume', {
        p_coupon_id: order.coupon_id,
      });
      if (!rpcErr && consumed === true) {
        await db.from('coupon_redemptions').insert({
          coupon_id: order.coupon_id,
          order_id: order.id,
          user_id: order.user_id,
          merchant_id: order.merchant_id,
          amount_cents_applied: order.discount_cents,
        });
      }
    }

    return NextResponse.json({ url, orderId: order.id });
  } catch (e: any) {
    console.error('[checkout] error', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
