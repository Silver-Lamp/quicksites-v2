// lib/commerce/adapters/stripeAdapter.ts
import { PaymentsAdapter } from '../paymentAdapter';
import { CreateCheckoutParams, CheckoutResult, WebhookEvent } from '../types';
import { stripe } from '@/lib/stripe/server';
import Stripe from 'stripe';

export class StripeAdapter implements PaymentsAdapter {
  provider() { return 'stripe' as const; }

  async createCheckout(p: CreateCheckoutParams): Promise<CheckoutResult> {
    // Build PI data so we can include both transfer + capture_method when needed
    const piData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      // ensure orderId also exists at the PI level
      metadata: { orderId: p.orderId, ...(p.metadata ?? {}) },
    };

    if (p.captureMethod) {
      piData.capture_method = p.captureMethod; // 'automatic' | 'manual'
    }

    if (p.platformFeeCents != null && p.connectAccountId) {
      piData.application_fee_amount = p.platformFeeCents;
      piData.transfer_data = { destination: p.connectAccountId };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
      allow_promotion_codes: true,
      line_items: p.lineItems.map(li => ({
        quantity: li.quantity,
        price_data: {
          currency: p.currency.toLowerCase(),
          unit_amount: li.unitAmount,
          product_data: { name: li.title },
        },
      })),
      // Keep a copy on the session too
      metadata: { orderId: p.orderId, ...(p.metadata ?? {}) },
      payment_intent_data: Object.keys(piData).length ? piData : undefined,
    });

    return { url: session.url!, providerRef: session.id };
  }

  async parseWebhook(raw: Buffer, headers: Record<string, string>): Promise<WebhookEvent> {
    const sig = headers['stripe-signature'];
    if (!sig) throw new Error('Missing Stripe signature header');

    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const event = stripe.webhooks.constructEvent(raw, sig, secret);

    switch (event.type) {
      // Checkout finished (synchronous payment methods)
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = (s.metadata as any)?.orderId ?? undefined;
        // amount_total can be null on very old API versions; guard it
        const amount = typeof s.amount_total === 'number' ? s.amount_total : undefined;
        return { id: event.id, type: 'payment_succeeded', orderId, amountCents: amount, raw: event };
      }

      // Async payment methods finishing later (e.g., bank redirects)
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = (s.metadata as any)?.orderId ?? undefined;
        const amount = typeof s.amount_total === 'number' ? s.amount_total : undefined;
        return { id: event.id, type: 'payment_succeeded', orderId, amountCents: amount, raw: event };
      }
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = (s.metadata as any)?.orderId ?? undefined;
        return { id: event.id, type: 'payment_failed', orderId, raw: event };
      }

      // PaymentIntent fallbacks
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = (pi.metadata as any)?.orderId ?? undefined;
        const amount = typeof pi.amount === 'number' ? pi.amount : undefined;
        return { id: event.id, type: 'payment_succeeded', orderId, amountCents: amount, raw: event };
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = (pi.metadata as any)?.orderId ?? undefined;
        const amount = typeof pi.amount === 'number' ? pi.amount : undefined;
        return { id: event.id, type: 'payment_failed', orderId, amountCents: amount, raw: event };
      }

      // Refunds
      case 'charge.refunded':
      case 'charge.refund.updated': {
        const ch = event.data.object as Stripe.Charge;
        const orderId = (ch.metadata as any)?.orderId ?? undefined;
        const refunded = typeof ch.amount_refunded === 'number' ? ch.amount_refunded : undefined;
        return { id: event.id, type: 'refund_succeeded', orderId, amountCents: refunded, raw: event };
      }

      // Ignore (treat as no-op rather than a failure)
      default:
        return { id: event.id, type: 'payment_failed', raw: event };
    }
  }
}
