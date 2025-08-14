import Stripe from 'stripe';
import type { PaymentProvider, CreateCheckoutParams, WebhookResult } from './types';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-07-30.basil' });

export const StripeProvider: PaymentProvider = {
  async createCheckout(p: CreateCheckoutParams) {
    const { amountCents, currency, successUrl, cancelUrl, connectedAccountId, applicationFeeBps, customerEmail, orderId } = p;
    const feeAmt = applicationFeeBps ? Math.floor((amountCents * applicationFeeBps) / 10_000) : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: amountCents, product_data: { name: `Order ${orderId}` } } }],
      success_url: `${successUrl}?order_id=${orderId}`,
      cancel_url: `${cancelUrl}?order_id=${orderId}`,
      customer_email: customerEmail,
      payment_intent_data: connectedAccountId ? {
        transfer_data: { destination: connectedAccountId },
        application_fee_amount: feeAmt,
        on_behalf_of: connectedAccountId
      } : undefined,
      metadata: { order_id: orderId }
    }, connectedAccountId ? { stripeAccount: connectedAccountId } : undefined);

    return { url: session.url! };
  },

  async handleWebhook(rawBody: Buffer, headers: Record<string,string>) {
    const sig = headers['stripe-signature'] as string;
    const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    const out: WebhookResult[] = [];

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.order_id;
        const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
        out.push({ ok: true, orderId, newStatus: 'paid', providerPaymentId: pi, raw: event });
        break;
      }
      case 'charge.refunded':
      case 'charge.refund.updated':
      case 'refund.updated': {
        const ch: any = event.data.object;
        const orderId = ch.metadata?.order_id || ch.payment_intent?.metadata?.order_id;
        out.push({ ok: true, orderId, newStatus: 'refunded', providerPaymentId: ch.payment_intent, raw: event });
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        out.push({ ok: true, orderId: pi.metadata?.order_id, newStatus: 'failed', providerPaymentId: pi.id, raw: event });
        break;
      }
      default:
        out.push({ ok: true, raw: event });
    }
    return out;
  }
};
