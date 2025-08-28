import { CreateCheckoutParams, CheckoutResult, WebhookEvent } from './types';

export interface PaymentsAdapter {
  provider(): 'stripe'|'paypal'|'square'|'authorize_net'|'custom';
  createCheckout(p: CreateCheckoutParams): Promise<CheckoutResult>;
  parseWebhook(raw: Buffer, headers: Record<string,string>): Promise<WebhookEvent>;
}