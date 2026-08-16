// The checkout must actually charge, and the receipt must not claim it did unless it can tell.
//
// ⚠️ WHAT THIS GUARDS AGAINST ACTUALLY SHIPPED, on a live site, for months. The checkout form
// collected a card number, waited 1200ms with setTimeout, minted a client-side order id, and
// routed to a receipt reading "Total paid $5.00". No API call, no order row, no charge —
// confirmed by querying the database after such an "order" appeared on the lemonade stand.
//
// Every individual piece looked plausible: the form validated with Luhn, the spinner spun, the
// receipt had an order id and a print button. Nothing was broken. It was a faithful simulation
// of a shop, wired to a real Stripe Connect merchant, on a domain a customer could reach.
//
// These assertions are crude on purpose. They check the SHAPE that made it possible — a payment
// path with no fetch in it, and a receipt that asserts payment unconditionally — because that
// shape is what a future "let me stub this out for now" recreates.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

/**
 * Read source with comments stripped.
 *
 * ⚠️ Second time this exact trap has been hit today. These files document the bug they fix by
 * quoting the old copy — so a naive search finds the phrase in the COMMENT, decides the code
 * still says it, and fails on correct code. Explaining a defect in a comment must never trip
 * the check that guards it, or the next person deletes the explanation to get green.
 */
const read = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('checkout charges through the real money path', () => {
  const src = read('components/cart/CheckoutPageClient.tsx');

  it('posts to the commerce checkout endpoint', () => {
    expect(src).toContain('/api/commerce/checkout');
  });

  it('hands off to the URL the server returns', () => {
    // The server creates the order and returns a Stripe Checkout URL; the client's only job is
    // to go there. A client that navigates anywhere else is not taking a payment.
    expect(src).toMatch(/checkoutUrl/);
    expect(src).toMatch(/window\.location\.href\s*=/);
  });

  it('sends ids and quantities, never prices', () => {
    // authorizeCheckoutItems reprices everything server-side. A client-sent amount is ignored,
    // but sending one at all invites someone to trust it later.
    expect(src).toContain('catalogItemId');
    expect(src).toContain('quantity');
    expect(src).not.toMatch(/unitAmount:/);
  });

  it('collects no card details — Stripe does that', () => {
    // A PAN in our DOM is a PCI obligation. The old form took one on, to discard it.
    expect(src).not.toMatch(/autoComplete=["']cc-number["']/);
    expect(src).not.toMatch(/\bluhnOk\b/);
    expect(src).not.toMatch(/Name on card/);
  });

  it('has no simulated payment left in it', () => {
    // The fake path was `await new Promise(r => setTimeout(r, 1200))` followed by a locally
    // minted id. Both are gone; neither should come back.
    expect(src).not.toMatch(/setTimeout/);
    expect(src).not.toMatch(/makeOrderId/);
  });
});

describe('the receipt only claims payment it can evidence', () => {
  const src = read('components/cart/ThankYouPageClient.tsx');

  it('gates the paid language on a server-issued order id', () => {
    expect(src).toMatch(/serverOrderId/);
    expect(src).toMatch(/isDemo/);
  });

  it('never states "Total paid" unconditionally', () => {
    // The string may appear, but only inside a branch. A bare occurrence means the receipt
    // asserts payment for every visitor, which is how this started.
    const bare = /<span>Total paid<\/span>/;
    expect(src).not.toMatch(bare);
  });

  it('does not promise an email nobody sent', () => {
    // "A receipt was sent to you" must be reachable only on the real path.
    const idx = src.indexOf('A receipt was sent');
    if (idx >= 0) {
      // Window has to clear the comment block above the JSX; 400 chars landed inside it and
      // failed on correct code. A check that cries wolf gets skipped, which is worse than none.
      const before = src.slice(Math.max(0, idx - 1500), idx);
      expect(before).toMatch(/isDemo/);
    }
  });
});
