import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSupabaseClient } from '@/lib/supabase/serverClient';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-07-30.basil' });

export async function POST(req: NextRequest) {
  const { siteId } = await req.json(); // delivered.menu site_id
  const supabase = await getServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // 1) Ensure a merchant for this user
  let { data: merchant } = await supabase.from('merchants').select('*').eq('user_id', user.id).maybeSingle();
  if (!merchant) {
    const ins = await supabase.from('merchants').insert({
      user_id: user.id,
      name: user.email || 'New Chef',
      provider: 'stripe',
      default_platform_fee_bps: 75
    }).select('*').single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    merchant = ins.data!;
  }

  // 2) Link to site
  const linkRes = await supabase.from('site_merchants')
    .upsert({ site_id: siteId, merchant_id: merchant.id, status: 'approved', role: 'chef' })
    .select('*').single();
  if (linkRes.error) return NextResponse.json({ error: linkRes.error.message }, { status: 500 });

  // 3) Ensure Stripe Express account
  const acctRow = await supabase.from('merchant_payment_accounts')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('provider', 'stripe')
    .maybeSingle();

  let accountId = acctRow.data?.provider_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express', email: user.email ?? undefined });
    accountId = account.id;
    const insAcct = await supabase.from('merchant_payment_accounts').insert({
      merchant_id: merchant.id,
      provider: 'stripe',
      provider_account_id: accountId
    });
    if (insAcct.error) return NextResponse.json({ error: insAcct.error.message }, { status: 500 });
  }

  // 4) Onboarding link
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.APP_BASE_URL}/connect/refresh?merchant_id=${merchant.id}`,
    return_url: `${process.env.APP_BASE_URL}/connect/return?merchant_id=${merchant.id}`,
    type: 'account_onboarding'
  });

  return NextResponse.json({ url: link.url, merchantId: merchant.id });
}
