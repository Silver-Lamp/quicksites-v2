// lib/commerce/__tests__/paymentIdCollapse.test.ts
//
// One payment must produce ONE ledger key, however many events Stripe sends about it.
//
// ⚠️ WHY THIS FILE EXISTS. The first live order recorded **two `payments` rows for one $4
// payment**, because the webhook keyed the ledger on `event.data.object.id` — `cs_…` for the
// session event, `pi_…` for the payment_intent event. Two keys, one movement of money, and the
// unique constraint on `(provider, provider_payment_id)` was powerless to collapse them.
//
// The companion bug ran the other way: the loser of the paid-transition race was discarded
// wholesale, losing the buyer identity that only the session event carries. Hence the pair of
// rules this file pins down:
//
//     Merge for facts. Collapse for money.
//     (PorchHearth, crosstalk 2026-08-17)
//
// These are source-level assertions rather than a live adapter run, because `parseWebhook`
// verifies a Stripe signature before it parses anything — the branch we care about sits behind
// a signature check we cannot satisfy in a unit test without stubbing the SDK. What can be
// checked here is the wiring, which is what actually regressed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adapter = readFileSync(join(process.cwd(), 'lib/commerce/adapters/stripeAdapter.ts'), 'utf8');
const route = readFileSync(join(process.cwd(), 'app/api/commerce/webhooks/stripe/route.ts'), 'utf8');
const types = readFileSync(join(process.cwd(), 'lib/commerce/types.ts'), 'utf8');

/** Body of one `case '<type>': { … }` block in the adapter's switch. */
function caseBlock(eventType: string): string {
  const at = adapter.indexOf(`case '${eventType}':`);
  expect(at).toBeGreaterThan(-1);
  return adapter.slice(at, adapter.indexOf('\n      }', at));
}

describe('the ledger key is the payment, not the event object', () => {
  it('the webhook no longer keys markOrderPaid on the event object id alone', () => {
    // ⚠️ Scope the assertion to the markOrderPaid CALL. A repo-wide negative match on
    // `e.raw.data.object.id` fires on the legitimate `paymentId ?? …` fallback *and* on the
    // refund call, which is correct code — a check that fails on a correct fix teaches you to
    // ignore its output (CLAUDE.md §7).
    const at = route.indexOf('await markOrderPaid(');
    expect(at).toBeGreaterThan(-1);
    const call = route.slice(at, route.indexOf(');', at));
    expect(call).toContain('e.paymentId ??');
    // The id argument must not be the bare object id.
    expect(call).not.toMatch(/'stripe',\s*e\.raw\.data\.object\.id/);
  });

  it('WebhookEvent declares paymentId', () => {
    expect(types).toMatch(/paymentId\?: string;/);
  });

  // The two events that fought over one $4 payment. Both must resolve a payment id, and both
  // must resolve it through the SAME helper — that is what makes them collapse to one row.
  it.each(['checkout.session.completed', 'payment_intent.succeeded', 'checkout.session.async_payment_succeeded'])(
    '%s carries a paymentId derived from the payment_intent',
    (eventType) => {
      expect(caseBlock(eventType)).toMatch(/paymentId: piId\(/);
    },
  );

  it('the helper prefers payment_intent over the object own id', () => {
    // The fallback to `o.id` is for zero-amount/setup-mode sessions, where the object id IS
    // the payment's identity. It must remain a FALLBACK — if it became the first choice the
    // original bug returns.
    const helper = adapter.slice(adapter.indexOf('const piId ='), adapter.indexOf('switch (event.type)'));
    expect(helper).toMatch(/o\?\.payment_intent/);
    expect(helper.indexOf('payment_intent')).toBeLessThan(helper.indexOf('typeof o?.id'));
  });
});

// ⚠️ The inverse trap, and it is the more dangerous one because it fails silently.
describe('refunds must NOT be keyed on the payment', () => {
  it('refund events carry no paymentId', () => {
    // `markOrderRefunded` writes into the SAME `payments` table under the SAME unique key with
    // `state='refunded'`. A refund keyed on the payment_intent id collides with the payment's
    // own row, hits the tolerated 23505 branch, and the refund is never recorded — no error,
    // no row, money unaccounted for.
    expect(caseBlock('charge.refunded')).not.toMatch(/paymentId:/);
  });

  it('markOrderRefunded still receives the charge id', () => {
    expect(route).toMatch(/markOrderRefunded\([^)]*e\.raw\.data\.object\.id,/);
  });

  it('the refund and payment inserts really do share one table and key', () => {
    // If this ever stops being true, the rule above can be revisited — but it must be
    // revisited deliberately, not discovered.
    const orders = readFileSync(join(process.cwd(), 'lib/commerce/orders.ts'), 'utf8');
    const inserts = orders.match(/from\('payments'\)\s*\.insert\(/g) ?? [];
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    expect(orders).toMatch(/state: 'succeeded'/);
    expect(orders).toMatch(/state: 'refunded'/);
  });
});
