import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * GET /api/connect/status?merchantId=...
 * Retrieves the merchant's Stripe account and flips payment_accounts.status to
 * 'active' once charges_enabled. Call this after onboarding returns (or anytime).
 */
export async function GET(req: NextRequest) {
  const merchantId = new URL(req.url).searchParams.get('merchantId');
  if (!merchantId) return NextResponse.json({ error: 'merchantId required' }, { status: 400 });

  const { data: pa } = await supabase
    .from('payment_accounts')
    .select('account_ref, status, collect_platform_fee, platform_fee_percent')
    .eq('merchant_id', merchantId)
    .eq('provider', 'stripe')
    .maybeSingle();

  if (!pa?.account_ref) return NextResponse.json({ connected: false });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ connected: true, status: pa.status, chargesEnabled: false, hint: 'no-stripe-key' });
  }

  const acct = await stripe.accounts.retrieve(pa.account_ref);
  const chargesEnabled = !!acct.charges_enabled;
  const payoutsEnabled = !!acct.payouts_enabled;
  const detailsSubmitted = !!acct.details_submitted;
  const newStatus = chargesEnabled ? 'active' : 'pending';

  if (newStatus !== pa.status) {
    await supabase
      .from('payment_accounts')
      .update({ status: newStatus })
      .eq('merchant_id', merchantId)
      .eq('provider', 'stripe');
    if (newStatus === 'active') {
      await captureServer(EVENTS.MERCHANT_CONNECTED, { merchant_id: merchantId }, merchantId);
    }
  }

  return NextResponse.json({
    connected: true,
    accountId: pa.account_ref,
    status: newStatus,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    collectPlatformFee: pa.collect_platform_fee,
    platformFeePercent: pa.platform_fee_percent,
  });
}
