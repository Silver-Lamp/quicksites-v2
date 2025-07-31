// app/api/stripe/create-checkout-session/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
// import { supabaseAdmin } from '@/lib/supabase/admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil' as Stripe.LatestApiVersion,
});

export async function POST(req: NextRequest) {
  const { domain, email, coupon } = await req.json();

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_MONTHLY_SITE_PRICE_ID!,
          quantity: 1,
        },
      ],
      metadata: { domain },
      discounts: coupon ? [{ coupon }] : undefined,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/claim-success?domain=${domain}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/claim/${domain}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe session error:', error);
    return NextResponse.json({ error: 'Checkout session failed.' }, { status: 500 });
  }
}
