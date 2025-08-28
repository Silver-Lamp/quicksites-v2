import { NextRequest, NextResponse } from 'next/server';
// import Stripe from 'stripe';
import { getServerSupabase } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';

export async function GET(req: NextRequest) {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Find merchant → merchant_billing row with a Stripe customer
  const { data: merchants } = await supa.from('merchants').select('id').eq('owner_id', u.user.id).order('created_at');
  const ids = (merchants || []).map(m => m.id);
  if (!ids.length) return NextResponse.json({ error: 'no_merchant' }, { status: 404 });

  const { data: mb } = await supa
    .from('merchant_billing')
    .select('stripe_customer_id')
    .in('merchant_id', ids)
    .not('stripe_customer_id', 'is', null)
    .limit(1);
  const customerId = mb?.[0]?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: 'no_customer' }, { status: 404 });

  const origin = process.env.QS_PUBLIC_URL || req.headers.get('origin') || 'http://localhost:3000';
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/profile?portal=1`,
  });

  return NextResponse.json({ url: portal.url });
}
