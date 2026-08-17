export type Money = number; // cents

export type LineItemInput = {
  // Optional: synthetic/ad-hoc line items (e.g. an admin test order) have no
  // catalog item. createDraftOrder + checkout already guard for its absence; the
  // public checkout route's Zod schema keeps it required for real merchant orders.
  catalogItemId?: string | null;
  title: string;
  quantity: number;
  unitAmount: Money;
};

export type CreateCheckoutParams = {
    orderId: string;
    currency: string;
    lineItems: LineItemInput[];
    successUrl: string;
    cancelUrl: string;
    captureMethod?: 'automatic' | 'manual';
    platformFeeCents?: Money;       // computed per config
    connectAccountId?: string | null; // Stripe Connect destination (acct_...)
    metadata?: Record<string, string>;
    collectShipping?: boolean;      // POD/physical carts → collect a shipping address
    shippingCents?: Money;          // flat shipping fee, charged as its own line item
  };
  
export type CheckoutResult = { url: string; providerRef: string };

export type WebhookEvent = {
  id: string;
  type: 'payment_succeeded' | 'payment_failed' | 'refund_succeeded';
  orderId?: string;
  amountCents?: Money;
  /**
   * Stable id of the PAYMENT, not of the event's own object.
   *
   * ⚠️ THE DISTINCTION IS LOAD-BEARING. Stripe sends several events for one payment —
   * `checkout.session.completed` (object id `cs_…`) and `payment_intent.succeeded`
   * (object id `pi_…`) — so keying anything on `event.data.object.id` gives one key per
   * *event*, and the `payments` unique constraint on `(provider, provider_payment_id)`
   * stops collapsing them. The first live order recorded **two payment rows for one $4
   * payment** for exactly that reason.
   *
   * The payment_intent id is the one identifier both events agree on, so it is what the
   * ledger keys on: a second row becomes a uniqueness violation the code already
   * tolerates, while every event is still free to contribute what it uniquely carries
   * (only the session event holds `customer_details`).
   *
   * Merge for facts, collapse for money. (PorchHearth, crosstalk 2026-08-17.)
   */
  paymentId?: string;
  raw: any;
};
