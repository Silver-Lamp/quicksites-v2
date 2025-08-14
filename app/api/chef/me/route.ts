import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!merchant) return NextResponse.json({ merchant: null });

  const { data: acct } = await supabase
    .from('merchant_payment_accounts')
    .select('provider_account_id')
    .eq('merchant_id', merchant.id)
    .eq('provider', 'stripe')
    .maybeSingle();

  const { data: links } = await supabase
    .from('site_merchants')
    .select('site_id, status, role')
    .eq('merchant_id', merchant.id);

  return NextResponse.json({
    merchant: {
      id: merchant.id,
      name: merchant.name,
      default_platform_fee_bps: merchant.default_platform_fee_bps
    },
    stripeAccountId: acct?.provider_account_id ?? null,
    sites: links ?? []
  });
}
