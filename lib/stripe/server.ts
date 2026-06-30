// lib/stripe/server.ts
import Stripe from 'stripe';
import { lazyClient } from '@/lib/lazyClient';

// @ts-expect-error
export const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] = '2024-06-20';

export const stripe = lazyClient(() => new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
}));
