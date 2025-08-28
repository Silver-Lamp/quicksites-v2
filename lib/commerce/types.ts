export type Money = number; // cents

export type LineItemInput = {
  catalogItemId: string;
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
  };
  
export type CheckoutResult = { url: string; providerRef: string };

export type WebhookEvent = {
  id: string;
  type: 'payment_succeeded' | 'payment_failed' | 'refund_succeeded';
  orderId?: string;
  amountCents?: Money;
  raw: any;
};
