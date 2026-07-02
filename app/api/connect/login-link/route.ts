import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { requireMerchantOwner } from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!);

/** Stripe Express dashboard login link for a connected merchant. */
export async function POST(req: NextRequest) {
  const { merchantId } = await req.json();
  if (!merchantId) return NextResponse.json({ error: 'merchantId required' }, { status: 400 });

  // A dashboard login link grants full access to the merchant's Stripe account —
  // only the merchant owner (or a platform admin) may request it.
  const gate = await requireMerchantOwner(merchantId);
  if (gate instanceof NextResponse) return gate;

  const { data: acct } = await supabase
    .from('payment_accounts')
    .select('account_ref')
    .eq('merchant_id', merchantId)
    .eq('provider', 'stripe')
    .maybeSingle();

  if (!acct?.account_ref) return NextResponse.json({ error: 'No Stripe account for merchant' }, { status: 404 });

  const login = await stripe.accounts.createLoginLink(acct.account_ref);
  return NextResponse.json({ url: login.url });
}
