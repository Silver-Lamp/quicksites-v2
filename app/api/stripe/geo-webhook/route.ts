// app/api/stripe/geo-webhook/route.ts
//
// Stripe webhook for geo-domain RENTAL subscriptions (separate from the commerce
// webhook so the money path is untouched). Records the subscription on checkout
// completion and tracks status changes. Configure a Stripe endpoint → this URL with
// events checkout.session.completed + customer.subscription.updated/deleted, and set
// STRIPE_GEO_WEBHOOK_SECRET. Fails closed in prod when the secret is unset.

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { setCampaignSubscription } from '@/lib/outreach/geoCampaigns';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_GEO_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed in prod; allow a clear 501 in dev so it's obvious it's unconfigured.
    return NextResponse.json({ error: 'geo webhook not configured' }, { status: process.env.NODE_ENV === 'production' ? 400 : 501 });
  }

  const sig = req.headers.get('stripe-signature') || '';
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e: any) {
    return NextResponse.json({ error: `invalid signature: ${e?.message || ''}` }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session;
      const campaignId = s.metadata?.geo_campaign_id || s.client_reference_id;
      if (campaignId) {
        await setCampaignSubscription(campaignId, {
          stripe_customer_id: (typeof s.customer === 'string' ? s.customer : s.customer?.id) || undefined,
          stripe_subscription_id: (typeof s.subscription === 'string' ? s.subscription : s.subscription?.id) || undefined,
          subscription_status: 'active',
          renter_email: s.customer_details?.email || undefined,
        });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const campaignId = sub.metadata?.geo_campaign_id;
      if (campaignId) {
        await setCampaignSubscription(campaignId, {
          subscription_status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
        });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
