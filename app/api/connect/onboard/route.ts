import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const { merchantId } = await req.json();

  const { data: existing } = await supabase.from('merchant_payment_accounts')
    .select('*').eq('merchant_id', merchantId).eq('provider','stripe').maybeSingle();

  let accountId = existing?.provider_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express' });
    accountId = account.id;
    await supabase.from('merchant_payment_accounts').insert({
      merchant_id: merchantId, provider: 'stripe', provider_account_id: accountId
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.APP_BASE_URL}/connect/refresh?merchant_id=${merchantId}`,
    return_url: `${process.env.APP_BASE_URL}/connect/return?merchant_id=${merchantId}`,
    type: 'account_onboarding'
  });

  return NextResponse.json({ url: link.url });
}
