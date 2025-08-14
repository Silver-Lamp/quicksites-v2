import { StripeProvider } from './stripe';
import type { PaymentProvider } from './types';

export function getProvider(kind: 'stripe'|'square' = 'stripe'): PaymentProvider {
  if (kind === 'stripe') return StripeProvider;
  return StripeProvider; // TODO: SquareProvider later
}
