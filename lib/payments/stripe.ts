// lib/payments/stripe.ts
import type Stripe from 'stripe';
import type { PaymentProvider, CreateCheckoutParams, WebhookResult } from './types';
import { stripe } from '@/lib/stripe/server';

function toLowerCurrency(cur: string) {
  return (cur || 'USD').toLowerCase();
}

function readOrderId(meta?: Record<string, any> | null): string | undefined {
  if (!meta) return undefined;
  // Prefer new key, fallback to legacy
  return (meta as any).orderId ?? (meta as any).order_id ?? undefined;
}

export const StripeProvider: PaymentProvider = {
  async createCheckout(p: CreateCheckoutParams) {
    const {
      amountCents,
      currency,
      successUrl,
      cancelUrl,
      connectedAccountId,       // acct_... for destination account
      applicationFeeBps,        // e.g. 750 = 7.5%
      customerEmail,
      orderId,
    } = p;

    const feeAmt =
      typeof applicationFeeBps === 'number'
        ? Math.floor((amountCents * applicationFeeBps) / 10_000)
        : undefined;

    // Build PaymentIntent config so we can include BOTH transfer and metadata
    const piData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
      metadata: { orderId, provider: 'stripe' },
    };
    if (connectedAccountId && typeof feeAmt === 'number') {
      piData.application_fee_amount = feeAmt;
      piData.transfer_data = { destination: connectedAccountId };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${successUrl}?order_id=${encodeURIComponent(orderId)}`,
      cancel_url: `${cancelUrl}?order_id=${encodeURIComponent(orderId)}`,
      allow_promotion_codes: true,
      customer_email: customerEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: toLowerCurrency(currency),
            unit_amount: amountCents,
            product_data: { name: `Order ${orderId}` },
          },
        },
      ],
      // Keep a copy on the session as well
      metadata: { orderId },
      payment_intent_data: Object.keys(piData).length ? piData : undefined,
    });

    return { url: session.url! };
  },

  async handleWebhook(rawBody: Buffer, headers: Record<string, string>) {
    const sig = headers['stripe-signature'];
    if (!sig) throw new Error('Missing Stripe signature header');

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    const out: WebhookResult[] = [];

    switch (event.type) {
      // Synchronous confirmation
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = readOrderId(s.metadata);
        const piId =
          typeof s.payment_intent === 'string'
            ? s.payment_intent
            : s.payment_intent?.id;
        out.push({
          ok: true,
          orderId,
          newStatus: 'paid',
          providerPaymentId: piId,
          raw: event,
        });
        break;
      }

      // Async flows resolving later
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = readOrderId(s.metadata);
        const piId =
          typeof s.payment_intent === 'string'
            ? s.payment_intent
            : s.payment_intent?.id;
        out.push({
          ok: true,
          orderId,
          newStatus: 'paid',
          providerPaymentId: piId,
          raw: event,
        });
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = readOrderId(s.metadata);
        const piId =
          typeof s.payment_intent === 'string'
            ? s.payment_intent
            : s.payment_intent?.id;
        out.push({
          ok: true,
          orderId,
          newStatus: 'failed',
          providerPaymentId: piId,
          raw: event,
        });
        break;
      }

      // PI fallbacks (some integrations subscribe to these directly)
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = readOrderId(pi.metadata);
        out.push({
          ok: true,
          orderId,
          newStatus: 'paid',
          providerPaymentId: pi.id,
          raw: event,
        });
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = readOrderId(pi.metadata);
        out.push({
          ok: true,
          orderId,
          newStatus: 'failed',
          providerPaymentId: pi.id,
          raw: event,
        });
        break;
      }

      // Refunds
      case 'charge.refunded':
      case 'charge.refund.updated':
      case 'refund.updated': {
        const ch = event.data.object as Stripe.Charge | any;
        // Try charge metadata, then PI metadata if available
        const orderId =
          readOrderId((ch as any).metadata) ||
          readOrderId((ch as any).payment_intent?.metadata);
        const providerPaymentId =
          typeof (ch as any).payment_intent === 'string'
            ? (ch as any).payment_intent
            : (ch as any).payment_intent?.id || (ch as any).id;

        out.push({
          ok: true,
          orderId,
          newStatus: 'refunded',
          providerPaymentId,
          raw: event,
        });
        break;
      }

      default:
        // No-op for unrelated events (stay idempotent)
        out.push({ ok: true, raw: event });
    }

    return out;
  },
};
