import { NextRequest, NextResponse } from 'next/server';
import { getProvider } from '@/lib/payments';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { makeToken } from '@/lib/review-token';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function ensureOrderReviewToken(orderId: string) {
  const { data: o } = await supabase.from('orders').select('id, review_token').eq('id', orderId).maybeSingle();
  if (o?.review_token) return o.review_token;

  let token = makeToken();
  for (let i=0;i<6;i++) {
    const { data: clash } = await supabase.from('orders').select('id').eq('review_token', token).maybeSingle();
    if (!clash) break; token = makeToken();
  }
  const exp = new Date(Date.now() + 60*24*3600e3).toISOString(); // 60 days
  await supabase.from('orders').update({
    review_token: token,
    review_token_issued_at: new Date().toISOString(),
    review_token_expires: exp
  }).eq('id', orderId);
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    const { data: order, error: e1 } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (e1 || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const { data: merchant } = await supabase.from('merchants').select('*').eq('id', order.merchant_id).single();
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const { data: acct } = await supabase.from('merchant_payment_accounts')
      .select('*').eq('merchant_id', merchant.id).eq('provider', merchant.provider).maybeSingle();

    // platform fee: prefer site override, else merchant default
    let applicationFeeBps = merchant.default_platform_fee_bps;
    if (order.site_id) {
      const { data: site } = await supabase.from('sites').select('platform_fee_bps').eq('id', order.site_id).maybeSingle();
      if (site?.platform_fee_bps != null) applicationFeeBps = site.platform_fee_bps;
    }

    const provider = getProvider(merchant.provider);
    const successUrl = `${process.env.APP_BASE_URL}/checkout/success`;
    const cancelUrl  = `${process.env.APP_BASE_URL}/checkout/cancel`;

    const res = await provider.createCheckout({
      orderId: order.id,
      amountCents: order.amount_cents,
      currency: order.currency,
      successUrl,
      cancelUrl,
      connectedAccountId: acct?.provider_account_id,
      applicationFeeBps
    });

    return NextResponse.json({ url: res.url });
  } catch (err:any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
