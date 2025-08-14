import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProvider } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { merchantId, siteId, amountCents, currency = 'usd' } = await req.json();

    if (!merchantId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'merchantId and positive amountCents required' }, { status: 400 });
    }

    // Insert order
    const { data: orderRow, error: e1 } = await db
      .from('orders')
      .insert({ merchant_id: merchantId, site_id: siteId ?? null, amount_cents: amountCents, currency })
      .select('*')
      .single();
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    // Load merchant + account + fee
    const { data: merchant } = await db.from('merchants').select('*').eq('id', merchantId).single();
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const { data: acct } = await db.from('merchant_payment_accounts')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('provider', merchant.provider)
      .maybeSingle();

    let applicationFeeBps = merchant.default_platform_fee_bps;
    if (siteId) {
      const { data: site } = await db.from('sites').select('platform_fee_bps').eq('id', siteId).maybeSingle();
      if (site?.platform_fee_bps != null) applicationFeeBps = site.platform_fee_bps;
    }

    const provider = getProvider(merchant.provider);
    const successUrl = `${process.env.APP_BASE_URL}/checkout/success`;
    const cancelUrl  = `${process.env.APP_BASE_URL}/checkout/cancel`;

    const res = await provider.createCheckout({
      orderId: orderRow.id,
      amountCents,
      currency,
      successUrl,
      cancelUrl,
      connectedAccountId: acct?.provider_account_id ?? undefined,
      applicationFeeBps
    });

    return NextResponse.json({ url: res.url, orderId: orderRow.id });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
