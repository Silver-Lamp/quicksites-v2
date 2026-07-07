// lib/commerce/__tests__/customers.test.ts
import { normalizeEmail, extractBuyerFromStripeEvent } from '../customers';

describe('normalizeEmail', () => {
  it('lowercases + trims valid emails, rejects junk', () => {
    expect(normalizeEmail('  Buyer@Example.COM ')).toBe('buyer@example.com');
    expect(normalizeEmail('no-at')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe('extractBuyerFromStripeEvent', () => {
  it('reads customer_details + customer id from a checkout.session event', () => {
    const event = {
      data: {
        object: {
          customer: 'cus_123',
          customer_details: { email: 'Jane@Shop.com', name: 'Jane Doe', phone: '+15551234567' },
        },
      },
    };
    expect(extractBuyerFromStripeEvent(event)).toEqual({
      email: 'jane@shop.com',
      name: 'Jane Doe',
      phone: '+15551234567',
      stripeCustomerId: 'cus_123',
    });
  });

  it('falls back to customer_email and omits empty fields', () => {
    expect(extractBuyerFromStripeEvent({ data: { object: { customer_email: 'x@y.com' } } })).toEqual({ email: 'x@y.com' });
  });

  it('accepts a bare session object (not wrapped in an event)', () => {
    expect(extractBuyerFromStripeEvent({ customer_details: { email: 'a@b.com' } })).toEqual({ email: 'a@b.com' });
  });

  it('returns null without a usable email', () => {
    expect(extractBuyerFromStripeEvent({ data: { object: { customer_details: { name: 'No Email' } } } })).toBeNull();
    expect(extractBuyerFromStripeEvent(null)).toBeNull();
  });
});
