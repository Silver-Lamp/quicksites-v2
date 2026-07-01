import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { createCheckout } from '@/lib/commerce/paymentRouter';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseJsonBody } from '@/lib/api/parseJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Money path: client-supplied amounts feed createDraftOrder (fee math) and
// Stripe, so validate strictly. Amounts are integer cents (CLAUDE.md §7).
const CheckoutSchema = z.object({
  merchantId: z.string().min(1),
  siteSlug: z.string().optional(),
  currency: z.string().length(3).optional(),
  items: z
    .array(
      z.object({
        catalogItemId: z.string().min(1),
        title: z.string().min(1),
        quantity: z.number().int().positive(),
        unitAmount: z.number().int().nonnegative(), // cents
      }),
    )
    .min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
type Body = z.infer<typeof CheckoutSchema>;

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, CheckoutSchema);
  if (!parsed.ok) return parsed.response;
  const body: Body = parsed.data;

  const supabase = await getServerSupabase({ serviceRole: true });

  let currency = body.currency;
  if (!currency) {
    const { data } = await supabase.from('merchants').select('default_currency').eq('id', body.merchantId).single();
    currency = data?.default_currency ?? 'USD';
  }

  const { orderId, totalCents, platformFeeCents, shippingCents } = await createDraftOrder({
    merchantId: body.merchantId,
    siteSlug: body.siteSlug ?? '',
    currency: currency ?? 'USD',
    items: body.items,
  });

  // If any line item is a print-on-demand product, collect a shipping address at
  // checkout so fulfillment (Lulu/Gelato) has somewhere to ship.
  let collectShipping = false;
  const catIds = body.items.map((i) => i.catalogItemId).filter(Boolean);
  if (catIds.length) {
    const { data: cis } = await supabase.from('catalog_items').select('metadata').in('id', catIds);
    collectShipping = (cis ?? []).some((c: any) => ['lulu', 'gelato'].includes(c?.metadata?.fulfillment_provider));
  }

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
      collectShipping,
      shippingCents,
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
