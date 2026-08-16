// The cart a customer sees is NOT app/cart.
//
// Middleware rewrites `<slug>.quicksites.ai/cart` → `/sites/<slug>/cart`, so on every tenant
// site the cart is rendered by this route. The first version of the Venmo panel resolved the
// handle in `app/cart/page.tsx` only — which works on the platform host and is invisible on
// every site that has customers. The inverse of what was wanted, and indistinguishable from
// the handle having failed to save yet again.
//
// This asserts the two clients rendered here are handed the handle.

import * as fs from 'fs';
import * as path from 'path';

const ROUTE = path.resolve(__dirname, '..', 'page.tsx');

describe('tenant site cart/checkout receive the venmo handle', () => {
  const src = fs.readFileSync(ROUTE, 'utf8');

  it('reads a non-empty route file', () => {
    expect(src.length).toBeGreaterThan(1000);
  });

  it('passes venmoHandle to the cart', () => {
    const line = src.split('\n').find((l) => l.includes("rest[0] === 'cart'"));
    expect(line).toBeDefined();
    expect(line).toMatch(/venmoHandle=\{/);
  });

  it('passes venmoHandle to checkout', () => {
    const line = src.split('\n').find((l) => l.includes("rest[0] === 'checkout'"));
    expect(line).toBeDefined();
    expect(line).toMatch(/venmoHandle=\{/);
  });

  it('resolves it by slug, not by host — the rewrite already hid the host once', () => {
    expect(src).toContain('venmoHandleForSlug');
    // A host-based lookup here would re-introduce the bug: the request host is the tenant's,
    // but reasoning about it from inside a rewritten route is the step that went wrong.
    expect(src).not.toContain('venmoHandleForCurrentHost');
  });
});
