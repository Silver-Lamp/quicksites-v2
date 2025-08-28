// app/api/stripe/create-checkout-session/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';

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
