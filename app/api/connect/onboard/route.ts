import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { clampPlatformFeePercent } from '@/lib/commerce/partner-terms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!);
const DEFAULT_FEE = clampPlatformFeePercent(Number(process.env.QS_DEFAULT_PLATFORM_FEE_PERCENT ?? '0.05') || 0);

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

  // Canonical row (pending until onboarding completes). Fee config seeded here;
  // adjustable later via /api/merchant/payment-accounts or the merchant UI.
  const { error } = await supabase.from('payment_accounts').upsert(
    {
      merchant_id: merchantId,
      provider: 'stripe',
      account_ref: accountId,
      status: 'pending',
      collect_platform_fee: DEFAULT_FEE > 0,
      platform_fee_percent: DEFAULT_FEE,
      platform_fee_min_cents: 0,
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
