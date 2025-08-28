import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/serverClient';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugFromUserId(uid: string) {
  return `acct-${uid.slice(0, 8)}`;
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const { siteId } = await req.json(); // delivered.menu site_id
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  const supabase = await getServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // 1) Ensure a Merchant (owner_id + required display_name, site_slug)
  let { data: merchant, error: mErr } = await supabase
    .from('merchants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  if (!merchant) {
    const displayName = user.user_metadata?.name || user.email || 'New Merchant';
    const site_slug = slugFromUserId(user.id);
    const ins = await supabase
      .from('merchants')
      .insert({
        owner_id: user.id,
        display_name: displayName,
        site_slug,
        default_currency: 'USD',
      })
      .select('*')
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    merchant = ins.data!;
  }

  // 2) Link to site (delivered.menu)
  const linkRes = await supabase
    .from('site_merchants')
    .upsert({ site_id: siteId, merchant_id: merchant.id, status: 'approved', role: 'chef' })
    .select('*')
    .single();
  if (linkRes.error) return NextResponse.json({ error: linkRes.error.message }, { status: 500 });

  // 3) Ensure Stripe Express account in payment_accounts
  const pa = await supabase
    .from('payment_accounts')
    .select('id, provider, account_ref, status')
    .eq('merchant_id', merchant.id)
    .eq('provider', 'stripe')
    .eq('status', 'active')
    .maybeSingle();

  let accountId = pa.data?.account_ref as string | undefined;

  if (!accountId) {
    // Create Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? undefined,
    });
    accountId = account.id;

    const insAcct = await supabase.from('payment_accounts').insert({
      merchant_id: merchant.id,
      provider: 'stripe',
      account_ref: accountId,
      status: 'active',
      capabilities: {}, // reserved for future use
    });
    if (insAcct.error) return NextResponse.json({ error: insAcct.error.message }, { status: 500 });
  }

  // 4) Create onboarding link
  const base = process.env.QS_PUBLIC_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/connect/refresh?merchant_id=${merchant.id}`,
    return_url: `${base}/connect/return?merchant_id=${merchant.id}`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url, merchantId: merchant.id, accountId });
}