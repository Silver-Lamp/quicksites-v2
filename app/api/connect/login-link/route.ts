import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-07-30.basil' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const { merchantId } = await req.json();
  const { data: acct } = await supabase.from('merchant_payment_accounts')
    .select('*').eq('merchant_id', merchantId).eq('provider','stripe').single();
  const login = await stripe.accounts.createLoginLink(acct.provider_account_id);
  return NextResponse.json({ url: login.url });
}
