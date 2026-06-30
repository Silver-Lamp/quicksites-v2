import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { createCheckout } from '@/lib/commerce/paymentRouter';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin "create a test order" tool. Mirrors the canonical public checkout
 * (app/api/commerce/checkout) so it exercises the real money path —
 * createDraftOrder (platform-fee math from payment_accounts) → Stripe Connect
 * checkout, falling back to a simulated paid order (markOrderPaid) when Stripe
 * is unconfigured or QS_TEST_CHECKOUT=1. That fallback is what proves
 * order → platform_fee → commission_ledger end-to-end without real Stripe.
 *
 * Replaces the old legacy path that read the deprecated merchant_payment_accounts
 * table + bps fees via @/lib/payments. payment_accounts is now the single source.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { merchantId, siteId, amountCents, currency } = await req.json();

    if (!merchantId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: 'merchantId and positive amountCents required' },
        { status: 400 },
      );
    }

    const supabase = await getServerSupabase({ serviceRole: true });

    let cur: string | undefined = currency;
    if (!cur) {
      const { data } = await supabase
        .from('merchants')
        .select('default_currency')
        .eq('id', merchantId)
        .single();
      cur = data?.default_currency ?? 'usd';
    }

    // A synthetic single line item for the requested amount (no catalog item).
    const items = [
      { catalogItemId: null, title: 'Admin test order', quantity: 1, unitAmount: amountCents },
    ];

    const { orderId, totalCents, platformFeeCents } = await createDraftOrder({
      merchantId,
      siteSlug: siteId ?? '',
      currency: cur ?? 'usd',
      items,
    });

    const base = process.env.QS_PUBLIC_URL ?? '';
    const successUrl = `${base}/checkout/success?order=${orderId}`;
    const cancelUrl = `${base}/checkout/cancel?order=${orderId}`;
    const forceTest = process.env.QS_TEST_CHECKOUT === '1';

    try {
      if (forceTest) throw new Error('QS_TEST_CHECKOUT');

      const checkout = await createCheckout(merchantId, {
        orderId,
        currency: cur ?? 'usd',
        lineItems: items,
        successUrl,
        cancelUrl,
        metadata: { siteSlug: siteId ?? '', source: 'admin_test_order' },
      });
      await supabase
        .from('orders')
        .update({ provider_checkout_id: checkout.providerRef })
        .eq('id', orderId);

      return NextResponse.json({ url: checkout.url, orderId, totalCents, platformFeeCents, test: false });
    } catch (e: any) {
      const msg = String(e?.message || '');
      const unconfigured = forceTest || /no active payment account/i.test(msg);
      if (!unconfigured) {
        return NextResponse.json({ error: msg || 'Checkout failed' }, { status: 502 });
      }

      // Test-mode fallback: simulate a successful payment so the full
      // order → platform_fee → commission_ledger path runs without real Stripe.
      await markOrderPaid(orderId, totalCents, 'test', `test_${orderId}`, {
        test: true,
        reason: forceTest ? 'forced' : 'no-payment-account',
        source: 'admin_test_order',
      });

      return NextResponse.json({
        url: `${base}/checkout/success?order=${orderId}&test=1`,
        orderId,
        totalCents,
        platformFeeCents,
        test: true,
      });
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
