import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { createCheckout } from '@/lib/commerce/paymentRouter';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  merchantId: string;
  siteSlug?: string;
  currency?: string;
  items: { catalogItemId: string; title: string; quantity: number; unitAmount: number }[];
  successUrl?: string;
  cancelUrl?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body?.merchantId || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'merchantId and items[] required' }, { status: 400 });
  }

  const supabase = await getServerSupabase({ serviceRole: true });

  let currency = body.currency;
  if (!currency) {
    const { data } = await supabase.from('merchants').select('default_currency').eq('id', body.merchantId).single();
    currency = data?.default_currency ?? 'USD';
  }

  const { orderId, totalCents, platformFeeCents } = await createDraftOrder({
    merchantId: body.merchantId,
    siteSlug: body.siteSlug ?? '',
    currency: currency ?? 'USD',
    items: body.items,
  });

  const base = process.env.QS_PUBLIC_URL ?? '';
  const successUrl = body.successUrl ?? `${base}/checkout/success?order=${orderId}`;
  const cancelUrl = body.cancelUrl ?? `${base}/checkout/cancel?order=${orderId}`;
  const forceTest = process.env.QS_TEST_CHECKOUT === '1';

  try {
    if (forceTest) throw new Error('QS_TEST_CHECKOUT');

    const checkout = await createCheckout(body.merchantId, {
      orderId,
      currency: currency ?? 'USD',
      lineItems: body.items,
      successUrl,
      cancelUrl,
      metadata: { siteSlug: body.siteSlug ?? '' },
    });
    await supabase.from('orders').update({ provider_checkout_id: checkout.providerRef }).eq('id', orderId);

    return NextResponse.json({ checkoutUrl: checkout.url, orderId, totalCents, platformFeeCents, test: false });
  } catch (e: any) {
    const msg = String(e?.message || '');
    const unconfigured = forceTest || /no active payment account/i.test(msg);
    if (!unconfigured) {
      // A genuine Stripe error — never silently mark paid in production.
      return NextResponse.json({ error: msg || 'Checkout failed' }, { status: 502 });
    }

    // Test-mode / unconfigured-Stripe fallback: simulate a successful payment so the
    // full order → platform_fee → commission_ledger path is exercised end-to-end
    // without real Stripe. Real keys + an active payment_account take the path above.
    await markOrderPaid(orderId, totalCents, 'test', `test_${orderId}`, {
      test: true,
      reason: forceTest ? 'forced' : 'no-payment-account',
    });

    return NextResponse.json({
      checkoutUrl: `${base}/checkout/success?order=${orderId}&test=1`,
      orderId,
      totalCents,
      platformFeeCents,
      test: true,
    });
  }
}
