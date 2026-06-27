import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/partners/connect/status — the logged-in partner's payout-account state.
 * Flips partner_payout_accounts.status to 'active' once payouts_enabled.
 */
export async function GET() {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = await getServerSupabase({ serviceRole: true });
  const { data: pa } = await admin
    .from('partner_payout_accounts')
    .select('account_ref, status')
    .eq('user_id', user.id)
    .eq('provider', 'stripe')
    .maybeSingle();

  if (!pa?.account_ref) return NextResponse.json({ connected: false });
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ connected: true, status: pa.status, payoutsEnabled: false, hint: 'no-stripe-key' });
  }

  const acct = await stripe.accounts.retrieve(pa.account_ref);
  const payoutsEnabled = !!acct.payouts_enabled;
  const newStatus = payoutsEnabled ? 'active' : 'pending';
  if (newStatus !== pa.status) {
    await admin
      .from('partner_payout_accounts')
      .update({ status: newStatus })
      .eq('user_id', user.id)
      .eq('provider', 'stripe');
  }

  return NextResponse.json({
    connected: true,
    status: newStatus,
    payoutsEnabled,
    detailsSubmitted: !!acct.details_submitted,
  });
}
