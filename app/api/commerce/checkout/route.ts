import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder } from '@/lib/commerce/orders';
import { createCheckout } from '@/lib/commerce/paymentRouter';
import { getServerSupabase } from '@/lib/supabase/server';

type Body = {
  merchantId: string;
  siteSlug: string;
  currency?: string;
  items: { catalogItemId: string; title: string; quantity: number; unitAmount: number }[];
  successUrl?: string;
  cancelUrl?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;

  // Pull default currency if absent
  const supabase = await getServerSupabase({ serviceRole: true });
  let currency = body.currency;
  if (!currency) {
    const { data } = await supabase.from('merchants').select('default_currency').eq('id', body.merchantId).single();
    currency = data?.default_currency ?? 'USD';
  }

  const { orderId, totalCents } = await createDraftOrder({
    merchantId: body.merchantId,
    siteSlug: body.siteSlug,
    currency: currency ?? 'USD',
    items: body.items,
  });

  const successUrl = body.successUrl ?? `${process.env.QS_PUBLIC_URL}/checkout/success?order=${orderId}`;
  const cancelUrl = body.cancelUrl ?? `${process.env.QS_PUBLIC_URL}/checkout/cancel?order=${orderId}`;

  const checkout = await createCheckout(body.merchantId, {
    orderId,
    currency: currency ?? 'USD',
    lineItems: body.items,
    successUrl,
    cancelUrl,
    metadata: { siteSlug: body.siteSlug }
  });

  // Persist provider session id
  await supabase.from('orders').update({ provider_checkout_id: checkout.providerRef }).eq('id', orderId);

  return NextResponse.json({ checkoutUrl: checkout.url, orderId, totalCents });
}
