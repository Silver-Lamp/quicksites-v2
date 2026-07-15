import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { resolveMerchantFeeDefault } from '@/lib/commerce/pricingPolicy';
import { requireMerchantOwner } from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!);

/**
 * Start Stripe Connect (Express) onboarding for a merchant and write the canonical
 * `payment_accounts` row. Status stays 'pending' until charges_enabled (finalized
 * by GET /api/connect/status). Replaces the deprecated merchant_payment_accounts path.
 */
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 400 });
  }
  const { merchantId } = await req.json();
  if (!merchantId) return NextResponse.json({ error: 'merchantId required' }, { status: 400 });

  const gate = await requireMerchantOwner(merchantId);
  if (gate instanceof NextResponse) return gate;

  // Reuse an existing connected account if we already started one
  const { data: existing } = await supabase
    .from('payment_accounts')
    .select('account_ref')
    .eq('merchant_id', merchantId)
    .eq('provider', 'stripe')
    .maybeSingle();

  let accountId = existing?.account_ref as string | undefined;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express' });
    accountId = account.id;
  }

  // Canonical row (pending until onboarding completes). Fee config seeded from the
  // market default for this merchant's vertical (menu-ordering → restaurant terms,
  // else general); adjustable later via /api/merchant/payment-accounts or the UI.
  const fee = await resolveMerchantFeeDefault(merchantId);
  const { error } = await supabase.from('payment_accounts').upsert(
    {
      merchant_id: merchantId,
      provider: 'stripe',
      account_ref: accountId,
      status: 'pending',
      collect_platform_fee: fee.collect,
      platform_fee_percent: fee.percent,
      platform_fee_min_cents: fee.minCents,
    },
    { onConflict: 'merchant_id,provider' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const base = process.env.APP_BASE_URL || process.env.QS_PUBLIC_URL || '';
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/merchant/connect?merchant=${merchantId}&state=refresh`,
    return_url: `${base}/merchant/connect?merchant=${merchantId}&state=return`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url, accountId });
}
