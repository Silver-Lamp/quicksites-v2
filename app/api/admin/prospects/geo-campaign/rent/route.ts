// app/api/admin/prospects/geo-campaign/rent/route.ts
//
// Create a Stripe subscription Checkout link to RENT a geo-domain to a business. The
// renter pays the effective rate (locked founder rate until page 1, then full — see
// lib/outreach/geoPricing.ts). The subscription id is captured by the geo Stripe webhook
// on completion; the rank-sync cron auto-steps the price up when the domain ranks.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, setCampaignSubscription } from '@/lib/outreach/geoCampaigns';
import { effectivePriceCents } from '@/lib/outreach/geoPricing';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured.', code: 'not_configured' }, { status: 501 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const campaignId = String(body.campaignId ?? '');
  if (!campaignId) return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });
  const renterEmail = typeof body.renterEmail === 'string' && body.renterEmail.trim() ? body.renterEmail.trim() : undefined;

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  const amount = effectivePriceCents(campaign);
  if (campaign.pricing_model !== 'flat' || !amount) {
    return NextResponse.json({ error: 'Set a flat plan + price on this campaign first.' }, { status: 400 });
  }

  const origin = publicBaseUrl();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: renterEmail,
      client_reference_id: campaignId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            recurring: { interval: 'month' },
            product_data: { name: `${campaign.domain} — local lead site` },
          },
        },
      ],
      subscription_data: { metadata: { geo_campaign_id: campaignId } },
      metadata: { geo_campaign_id: campaignId },
      success_url: `${origin}/admin/prospects?rented=1`,
      cancel_url: `${origin}/admin/prospects?rent_canceled=1`,
    });

    await setCampaignSubscription(campaignId, {
      renter_email: renterEmail,
      subscription_status: 'checkout_created',
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not create the checkout session.' }, { status: 502 });
  }
}
