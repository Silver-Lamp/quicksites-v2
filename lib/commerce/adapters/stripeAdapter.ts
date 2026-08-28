// lib/commerce/adapters/stripeAdapter.ts
import { PaymentsAdapter } from '../paymentAdapter';
import { CreateCheckoutParams, CheckoutResult, WebhookEvent } from '../types';
import { stripe } from '@/lib/stripe/server';
import Stripe from 'stripe';
import { stripeOnBehalfOfEnabled } from '@/lib/payments/onBehalfOf';

export class StripeAdapter implements PaymentsAdapter {
  provider() {
    return 'stripe' as const;
  }

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
      // Flag-gated: shift Stripe's fee incidence + merchant-of-record to the connected account
      // so QS keeps the full application fee (docs/REFERRAL_PRICING.md). OFF by default.
      if (stripeOnBehalfOfEnabled()) piData.on_behalf_of = p.connectAccountId;
    }

    // Physical/POD carts need a shipping address for fulfillment (Lulu/Gelato).
    const SHIP_COUNTRIES = (process.env.QS_SHIP_COUNTRIES || 'US,CA,GB,AU,IE,NZ')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean) as any[];

    // Stripe Tax for physical/POD orders — off unless QS_STRIPE_TAX_ENABLED=true
    // (requires Stripe Tax to be set up on the account).
    const taxOn = p.collectShipping && process.env.QS_STRIPE_TAX_ENABLED === 'true';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
      allow_promotion_codes: true,
      ...(p.collectShipping
        ? {
            shipping_address_collection: { allowed_countries: SHIP_COUNTRIES },
            phone_number_collection: { enabled: true },
          }
        : {}),
      ...(taxOn ? { automatic_tax: { enabled: true } } : {}),
      line_items: [
        ...p.lineItems.map((li) => ({
          quantity: li.quantity,
          price_data: {
            currency: p.currency.toLowerCase(),
            unit_amount: li.unitAmount,
            product_data: { name: li.title },
            ...(taxOn ? { tax_behavior: 'exclusive' as const } : {}),
          },
        })),
        // Flat shipping as its own line item (not part of the platform-fee basis).
        ...(p.shippingCents && p.shippingCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: p.currency.toLowerCase(),
                  unit_amount: p.shippingCents,
                  product_data: { name: 'Shipping' },
                  ...(taxOn ? { tax_behavior: 'exclusive' as const } : {}),
                },
              },
            ]
          : []),
      ],
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

    /**
     * The payment_intent id — the one identifier every event about a single payment agrees
     * on. See `WebhookEvent.paymentId`: keying the ledger on the event's own object id gave
     * two `payments` rows for one $4 payment, because a session and a payment_intent are two
     * objects describing one movement of money.
     *
     * Falls back to the object's own id only when there is genuinely no payment_intent
     * (zero-amount or setup-mode sessions), where the object id IS the payment's identity.
     */
    const piId = (o: any): string | undefined => {
      const pi = o?.payment_intent ?? (o?.object === 'payment_intent' ? o.id : undefined);
      const id = typeof pi === 'string' ? pi : pi?.id;
      return id || (typeof o?.id === 'string' ? o.id : undefined);
    };

    switch (event.type) {
      // Checkout finished (synchronous payment methods)
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = (s.metadata as any)?.orderId ?? undefined;
        // amount_total can be null on very old API versions; guard it
        const amount = typeof s.amount_total === 'number' ? s.amount_total : undefined;
        return {
          id: event.id,
          type: 'payment_succeeded',
          orderId,
          amountCents: amount,
          paymentId: piId(s),
          raw: event,
        };
      }

      // Async payment methods finishing later (e.g., bank redirects)
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = (s.metadata as any)?.orderId ?? undefined;
        const amount = typeof s.amount_total === 'number' ? s.amount_total : undefined;
        return {
          id: event.id,
          type: 'payment_succeeded',
          orderId,
          amountCents: amount,
          paymentId: piId(s),
          raw: event,
        };
      }
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = (s.metadata as any)?.orderId ?? undefined;
        return { id: event.id, type: 'payment_failed', orderId, paymentId: piId(s), raw: event };
      }

      // PaymentIntent fallbacks
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = (pi.metadata as any)?.orderId ?? undefined;
        const amount = typeof pi.amount === 'number' ? pi.amount : undefined;
        return {
          id: event.id,
          type: 'payment_succeeded',
          orderId,
          amountCents: amount,
          paymentId: piId(pi),
          raw: event,
        };
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = (pi.metadata as any)?.orderId ?? undefined;
        const amount = typeof pi.amount === 'number' ? pi.amount : undefined;
        return {
          id: event.id,
          type: 'payment_failed',
          orderId,
          amountCents: amount,
          paymentId: piId(pi),
          raw: event,
        };
      }

      // Refunds
      //
      // ⚠️ DELIBERATELY NO `paymentId` HERE, AND SETTING ONE WOULD BE A SILENT MONEY BUG.
      // `markOrderRefunded` writes the refund into the SAME `payments` table under the SAME
      // unique key `(provider, provider_payment_id)`, with `state='refunded'`. So keying a
      // refund on the payment_intent id would collide with the payment's own row, hit the
      // `23505` branch that is deliberately tolerated — and the refund would never be
      // recorded at all, with nothing raised.
      //
      // The charge id is already the correct key: both `charge.refunded` and
      // `charge.refund.updated` describe the same charge, so they collapse to one row
      // correctly today. Leaving `paymentId` undefined keeps the trap unreachable rather
      // than merely documented.
      case 'charge.refunded':
      case 'charge.refund.updated': {
        const ch = event.data.object as Stripe.Charge;
        const orderId = (ch.metadata as any)?.orderId ?? undefined;
        const refunded = typeof ch.amount_refunded === 'number' ? ch.amount_refunded : undefined;
        return {
          id: event.id,
          type: 'refund_succeeded',
          orderId,
          amountCents: refunded,
          raw: event,
        };
      }

      // Ignore (treat as no-op rather than a failure)
      default:
        return { id: event.id, type: 'payment_failed', raw: event };
    }
  }
}
