import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDraftOrder, markOrderPaid } from '@/lib/commerce/orders';
import { createCheckout } from '@/lib/commerce/paymentRouter';
import { getServerSupabase } from '@/lib/supabase/server';
import { parseJsonBody } from '@/lib/api/parseJson';
import { authorizeCheckoutItems } from '@/lib/commerce/checkoutItems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Money path. The client posts catalog item ids + quantities; PRICES are resolved
// server-side from catalog_items (see authorizeCheckoutItems) — a client-sent
// title/unitAmount is accepted for back-compat but ignored, so nobody can set
// their own price. Amounts are integer cents (CLAUDE.md §7).
const CheckoutSchema = z.object({
  merchantId: z.string().min(1),
  siteSlug: z.string().optional(),
  currency: z.string().length(3).optional(),
  items: z
    .array(
      z.object({
        catalogItemId: z.string().min(1),
        variantId: z.string().optional(), // selected variant, when the item has variants
        title: z.string().optional(), // ignored — derived from catalog_items
        quantity: z.number().int().positive(),
        unitAmount: z.number().int().nonnegative().optional(), // ignored — repriced server-side
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

  // Resolve authoritative prices from the catalog — never trust client amounts.
  const catIds = Array.from(new Set(body.items.map((i) => i.catalogItemId).filter(Boolean)));
  const { data: catalogRows } = await supabase
    .from('catalog_items')
    .select('id, merchant_id, title, price_cents, status, metadata')
    .in('id', catIds);

  const priced = authorizeCheckoutItems({
    merchantId: body.merchantId,
    requested: body.items,
    catalogRows: (catalogRows ?? []) as any,
  });
  if (!priced.ok) {
    return NextResponse.json({ error: priced.error, itemId: priced.badItemId }, { status: 400 });
  }
  const items = priced.items;

  const { orderId, totalCents, platformFeeCents, shippingCents } = await createDraftOrder({
    merchantId: body.merchantId,
    siteSlug: body.siteSlug ?? '',
    currency: currency ?? 'USD',
    items,
  });

  // Reserve stock atomically (holds it for ~30 min) so a concurrent buyer can't
  // take the last unit mid-checkout. A shortfall here means it sold out DURING
  // checkout — cancel the draft and tell the buyer BEFORE any payment. Infra
  // errors fail open (the paid-time atomic decrement still guards).
  const soldOut: Array<{ title: string; variant_label: string | null; remaining: number | null }> = [];
  for (const it of items) {
    const variantId = (it.metadata as any)?.variant_id ?? null;
    const { data: r, error: rErr } = await (supabase as any).rpc('reserve_catalog_stock', {
      p_order: orderId, p_item: it.catalogItemId, p_variant: variantId, p_qty: it.quantity, p_ttl_minutes: 30,
    });
    if (rErr) { console.warn('reserve_catalog_stock failed:', rErr.message); continue; }
    if (r && r.ok === false && r.reason === 'insufficient') {
      soldOut.push({ title: it.title, variant_label: (it.metadata as any)?.variant_label ?? null, remaining: r.remaining ?? 0 });
    }
  }
  if (soldOut.length) {
    await (supabase as any).rpc('release_order_reservations', { p_order: orderId });
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    return NextResponse.json({ error: 'Some items just sold out.', soldOut }, { status: 409 });
  }

  // If any line item is a print-on-demand product, collect a shipping address at
  // checkout so fulfillment (Lulu/Gelato) has somewhere to ship.
  const collectShipping = (catalogRows ?? []).some(
    (c: any) => ['lulu', 'gelato'].includes(c?.metadata?.fulfillment_provider),
  );

  const base = process.env.QS_PUBLIC_URL ?? '';
  const successUrl = body.successUrl ?? `${base}/checkout/success?order=${orderId}`;
  const cancelUrl = body.cancelUrl ?? `${base}/checkout/cancel?order=${orderId}`;
  const forceTest = process.env.QS_TEST_CHECKOUT === '1';

  try {
    if (forceTest) throw new Error('QS_TEST_CHECKOUT');

    const checkout = await createCheckout(body.merchantId, {
      orderId,
      currency: currency ?? 'USD',
      lineItems: items,
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
      // A genuine Stripe error — never silently mark paid in production. Release
      // the stock we reserved: no payment will follow.
      await (supabase as any).rpc('release_order_reservations', { p_order: orderId });
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
