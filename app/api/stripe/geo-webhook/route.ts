// app/api/stripe/geo-webhook/route.ts
//
// Stripe webhook for geo-domain RENTAL subscriptions (separate from the commerce
// webhook so the money path is untouched). Records the subscription on checkout
// completion and tracks status changes. Configure a Stripe endpoint → this URL with
// events checkout.session.completed + customer.subscription.updated/deleted +
// invoice.paid/invoice.payment_failed/charge.refunded, and set
// STRIPE_GEO_WEBHOOK_SECRET. Fails closed in prod when the secret is unset.

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import {
  setCampaignSubscription,
  getGeoCampaignBySubscriptionId,
  recordCampaignPayment,
} from '@/lib/outreach/geoCampaigns';
import { recordRentalCommissions, voidRentalCommissions } from '@/lib/commerce/rentalCommissions';
import * as Sentry from '@sentry/nextjs';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_GEO_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed in prod; allow a clear 501 in dev so it's obvious it's unconfigured.
    return NextResponse.json(
      { error: 'geo webhook not configured' },
      { status: process.env.NODE_ENV === 'production' ? 400 : 501 }
    );
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
          stripe_customer_id:
            (typeof s.customer === 'string' ? s.customer : s.customer?.id) || undefined,
          stripe_subscription_id:
            (typeof s.subscription === 'string' ? s.subscription : s.subscription?.id) || undefined,
          subscription_status: 'active',
          renter_email: s.customer_details?.email || undefined,
        });
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const campaignId = sub.metadata?.geo_campaign_id;
      if (campaignId) {
        await setCampaignSubscription(campaignId, {
          subscription_status:
            event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
        });
      }
    } else if (event.type === 'invoice.paid') {
      // The ONLY event that distinguishes "still paying" from "paid once, months ago".
      // subscription.updated fires on renewal too, but it writes status='active' — the value
      // the row already held — so cycle 2 was indistinguishable from no cycle at all.
      const inv = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdOf(inv);
      const campaign = subId ? await getGeoCampaignBySubscriptionId(subId) : null;
      if (campaign) {
        await recordCampaignPayment(campaign.id, {
          invoiceId: inv.id!,
          amountCents: inv.amount_paid ?? null,
          paidAt: new Date((inv.status_transitions?.paid_at ?? event.created) * 1000).toISOString(),
        });

        // Accrue the closer's commission and any manager override. Best-effort on purpose:
        // a failure here must not 500 the webhook, because Stripe would retry a payment we
        // have already recorded — and the payment landing is the fact that matters most.
        try {
          await recordRentalCommissions({
            campaignId: campaign.id,
            invoiceId: inv.id!,
            amountPaidCents: inv.amount_paid ?? 0,
            currency: inv.currency,
          });
        } catch (e: any) {
          console.warn('rental commission accrual failed:', e?.message);
          Sentry.captureMessage('rental commission accrual failed', {
            level: 'error',
            extra: { campaign_id: campaign.id, invoice_id: inv.id, message: e?.message },
          } as any);
        }
      }
    } else if (event.type === 'charge.refunded') {
      // Reverse the commissions for the invoice this charge paid. Rows already paid out are
      // left standing and reported, because money that has left cannot be un-owed by an
      // UPDATE — pretending otherwise erases the fact that it needs clawing back.
      const charge = event.data.object as Stripe.Charge;
      const invoiceId =
        typeof (charge as any).invoice === 'string'
          ? (charge as any).invoice
          : (charge as any).invoice?.id;
      if (invoiceId) {
        const { alreadyPaid } = await voidRentalCommissions(invoiceId);
        if (alreadyPaid > 0) {
          Sentry.captureMessage('rental refund on already-paid commissions', {
            level: 'warning',
            extra: { invoice_id: invoiceId, already_paid_rows: alreadyPaid },
          } as any);
        }
      }
    } else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdOf(inv);
      const campaign = subId ? await getGeoCampaignBySubscriptionId(subId) : null;
      if (campaign) {
        await setCampaignSubscription(campaign.id, { subscription_status: 'past_due' });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * The subscription an invoice belongs to. Stripe moved this from `invoice.subscription` to
 * `invoice.parent.subscription_details.subscription` in the 2025-08 API version; read both so
 * the handler survives an account-level API-version bump rather than silently matching nothing.
 */
function subscriptionIdOf(inv: Stripe.Invoice): string | null {
  const anyInv = inv as any;
  const direct = anyInv.subscription;
  if (typeof direct === 'string') return direct;
  if (direct?.id) return direct.id;
  const nested = anyInv.parent?.subscription_details?.subscription;
  if (typeof nested === 'string') return nested;
  if (nested?.id) return nested.id;
  return null;
}
