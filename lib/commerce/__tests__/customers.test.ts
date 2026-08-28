// lib/commerce/__tests__/customers.test.ts
import {
  normalizeEmail,
  extractBuyerFromStripeEvent,
  recordCustomerForAlreadyPaidOrder,
} from '../customers';

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
    expect(
      extractBuyerFromStripeEvent({ data: { object: { customer_email: 'x@y.com' } } })
    ).toEqual({ email: 'x@y.com' });
  });

  it('accepts a bare session object (not wrapped in an event)', () => {
    expect(extractBuyerFromStripeEvent({ customer_details: { email: 'a@b.com' } })).toEqual({
      email: 'a@b.com',
    });
  });

  it('returns null without a usable email', () => {
    expect(
      extractBuyerFromStripeEvent({ data: { object: { customer_details: { name: 'No Email' } } } })
    ).toBeNull();
    expect(extractBuyerFromStripeEvent(null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// The two-event race, from the first live order (2026-08-16).
//
// ⚠️ THE SHAPES BELOW ARE REAL, taken from `payments.raw` on order 181e76f0 (email
// redacted). Both events landed for one $4.00 payment; the payment_intent arrived first and
// won the pending→paid transition, so the session event — the ONLY one carrying the buyer —
// was discarded at markOrderPaid's duplicate early-return. Result: a paid live order and
// zero rows in `customers`, database-wide.
//
// These tests encode the asymmetry that makes the race matter. If a future refactor makes a
// payment_intent event yield a buyer, the first case fails and the recovery path can be
// reconsidered; until then, losing the session event means losing the customer.
// ─────────────────────────────────────────────────────────────────────────────────────────
const PAYMENT_INTENT_EVENT = {
  id: 'evt_pi',
  type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_3U5Dgv', object: 'payment_intent', amount: 400, metadata: {} } },
};
const CHECKOUT_SESSION_EVENT = {
  id: 'evt_cs',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_live_b1A59z',
      object: 'checkout.session',
      amount_total: 400,
      customer_email: null,
      customer_details: {
        name: 'Buyer Name',
        email: 'buyer@example.com',
        phone: null,
        address: { city: null, line1: null, postal_code: null },
      },
    },
  },
};

describe('the buyer arrives on only ONE of the two events Stripe sends', () => {
  it('finds no buyer on payment_intent.succeeded — it carries none', () => {
    expect(extractBuyerFromStripeEvent(PAYMENT_INTENT_EVENT)).toBeNull();
  });

  it('finds the buyer on checkout.session.completed', () => {
    expect(extractBuyerFromStripeEvent(CHECKOUT_SESSION_EVENT)).toEqual({
      email: 'buyer@example.com',
      name: 'Buyer Name',
    });
  });
});

describe('recordCustomerForAlreadyPaidOrder (the late-event recovery)', () => {
  /** Minimal service-role stub: records the rpc calls and the order patch. */
  function stub(orderRow: any) {
    const calls: { rpc: any[]; updates: any[] } = { rpc: [], updates: [] };
    const supabase: any = {
      rpc: (name: string, args: any) => {
        calls.rpc.push({ name, args });
        return Promise.resolve({ data: 'cust_1', error: null });
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: orderRow, error: null }),
            // emitBuyerEvents reads the customer back
            ...(table === 'customers' ? {} : {}),
          }),
        }),
        update: (patch: any) => ({
          eq: () => {
            calls.updates.push({ table, patch });
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    };
    return { supabase, calls };
  }

  const order = { merchant_id: 'm_1', customer_email: null, total_cents: 400 };

  it('recovers the buyer when the winning event had none', async () => {
    const { supabase, calls } = stub(order);
    await recordCustomerForAlreadyPaidOrder(supabase, {
      orderId: 'o_1',
      amountCents: 400,
      raw: CHECKOUT_SESSION_EVENT,
    });
    expect(calls.rpc.map((c) => c.name)).toContain('upsert_customer_from_order');
    expect(calls.rpc[0].args.p_email).toBe('buyer@example.com');
    // LTV uses the order's real total, not the event amount.
    expect(calls.rpc[0].args.p_total).toBe(400);
    expect(calls.updates.some((u) => u.patch.customer_email === 'buyer@example.com')).toBe(true);
  });

  it('does nothing for a payment_intent duplicate — and spends no query doing it', async () => {
    const { supabase, calls } = stub(order);
    let queried = false;
    supabase.from = () => {
      queried = true;
      throw new Error('should not query');
    };
    await recordCustomerForAlreadyPaidOrder(supabase, {
      orderId: 'o_1',
      amountCents: 400,
      raw: PAYMENT_INTENT_EVENT,
    });
    expect(queried).toBe(false);
    expect(calls.rpc).toHaveLength(0);
  });

  // ⚠️ The guard that keeps it from double-counting lifetime value on a Stripe retry.
  it('skips an order whose buyer is already recorded', async () => {
    const { supabase, calls } = stub({ ...order, customer_email: 'buyer@example.com' });
    await recordCustomerForAlreadyPaidOrder(supabase, {
      orderId: 'o_1',
      amountCents: 400,
      raw: CHECKOUT_SESSION_EVENT,
    });
    expect(calls.rpc).toHaveLength(0);
  });

  it('skips an order with no merchant', async () => {
    const { supabase, calls } = stub({ ...order, merchant_id: null });
    await recordCustomerForAlreadyPaidOrder(supabase, {
      orderId: 'o_1',
      amountCents: 400,
      raw: CHECKOUT_SESSION_EVENT,
    });
    expect(calls.rpc).toHaveLength(0);
  });

  it('never throws when the query fails — the paid transition must not depend on it', async () => {
    const supabase: any = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error('boom')) }) }),
      }),
    };
    await expect(
      recordCustomerForAlreadyPaidOrder(supabase, {
        orderId: 'o_1',
        amountCents: 400,
        raw: CHECKOUT_SESSION_EVENT,
      })
    ).resolves.toBeUndefined();
  });
});

// The fix is only real if markOrderPaid's early return actually calls it. A recovery function
// nobody invokes is the shape of bug this repo has shipped more than once.
describe('markOrderPaid wires the recovery into its duplicate-event return', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(), 'lib/commerce/orders.ts'),
    'utf8'
  );

  it('imports and calls recordCustomerForAlreadyPaidOrder', () => {
    expect(src).toMatch(
      /import \{[^}]*recordCustomerForAlreadyPaidOrder[^}]*\} from '\.\/customers'/
    );
    expect(src).toMatch(
      /await recordCustomerForAlreadyPaidOrder\(supabase, \{ orderId, amountCents, raw \}\)/
    );
  });

  it('does not return bare on a failed transition', () => {
    // The regression: `if (!transitioned || transitioned.length === 0) return;`
    expect(src).not.toMatch(/transitioned\.length === 0\) return;/);
  });
});
