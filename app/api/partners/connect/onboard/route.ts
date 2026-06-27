import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/partners/connect/onboard — the logged-in partner connects a Stripe
 * Express account to RECEIVE payouts. Writes partner_payout_accounts (status
 * 'pending' until payouts_enabled, finalized by GET .../status). Once active,
 * runPayouts transfers their residual here instead of recording a manual payout.
 */
export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 400 });
  }
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = await getServerSupabase({ serviceRole: true });
  const { data: existing } = await admin
    .from('partner_payout_accounts')
    .select('account_ref')
    .eq('user_id', user.id)
    .eq('provider', 'stripe')
    .maybeSingle();

  let accountId = existing?.account_ref as string | undefined;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express', metadata: { partner_user_id: user.id } });
    accountId = account.id;
  }

  const { error } = await admin
    .from('partner_payout_accounts')
    .upsert(
      { user_id: user.id, provider: 'stripe', account_ref: accountId, status: 'pending' },
      { onConflict: 'user_id,provider' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const base = process.env.APP_BASE_URL || process.env.QS_PUBLIC_URL || '';
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/partners/dashboard?connect=refresh`,
    return_url: `${base}/partners/dashboard?connect=return`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url });
}
