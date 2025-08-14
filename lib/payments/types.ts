export interface CreateCheckoutParams {
    orderId: string;
    amountCents: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
    connectedAccountId?: string; // marketplace mode if present
    applicationFeeBps?: number;  // e.g. 75 = 0.75%
    customerEmail?: string;
  }
  
  export interface WebhookResult {
    ok: boolean;
    orderId?: string;
    newStatus?: 'paid'|'refunded'|'failed';
    providerPaymentId?: string;
    raw?: any;
  }
  
  export interface PaymentProvider {
    createCheckout(p: CreateCheckoutParams): Promise<{ url: string }>;
    handleWebhook(rawBody: Buffer, headers: Record<string,string>): Promise<WebhookResult[]>;
  }
  