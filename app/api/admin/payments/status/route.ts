import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Connection + fee status for the admin payments panel. Reads the canonical
 * payment_accounts table (account_ref + platform_fee_percent), replacing the
 * deprecated merchant_payment_accounts / merchants.default_platform_fee_bps path.
 * Converts the stored 0..1 percent to basis points for the existing bps-based UI.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const merchantId = url.searchParams.get('merchantId');
  if (!merchantId) {
    return NextResponse.json({ error: 'merchantId required' }, { status: 400 });
  }

  const db = await getServerSupabase({ serviceRole: true });

  const { data: acct } = await db
    .from('payment_accounts')
    .select('account_ref, provider, platform_fee_percent, status')
    .eq('merchant_id', merchantId)
    .eq('provider', 'stripe')
    .order('status', { ascending: true }) // 'active' sorts before 'pending'
    .limit(1)
    .maybeSingle();

  const stripeAccountId = acct?.status === 'active' ? acct?.account_ref ?? null : null;
  const platformFeeBps =
    acct?.platform_fee_percent != null ? Math.round(Number(acct.platform_fee_percent) * 10000) : null;

  return NextResponse.json({ stripeAccountId, platformFeeBps });
}
