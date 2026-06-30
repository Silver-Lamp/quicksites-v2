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
  };
  
export type CheckoutResult = { url: string; providerRef: string };

export type WebhookEvent = {
  id: string;
  type: 'payment_succeeded' | 'payment_failed' | 'refund_succeeded';
  orderId?: string;
  amountCents?: Money;
  raw: any;
};
