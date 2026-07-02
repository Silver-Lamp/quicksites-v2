// lib/commerce/__tests__/checkoutItems.test.ts
//
// Server-side price authority for storefront checkout (gap #7). The load-bearing
// property: the price charged comes from catalog_items, never from the request —
// so a tampered unitAmount can't turn a $50 product into a $0.01 purchase.

import { authorizeCheckoutItems, type CatalogRow } from '../checkoutItems';

const M = 'merchant-1';
const row = (over: Partial<CatalogRow> = {}): CatalogRow => ({
  id: 'ci-1',
  merchant_id: M,
  title: 'Widget',
  price_cents: 5000,
  status: 'active',
  metadata: {},
  ...over,
});

describe('authorizeCheckoutItems', () => {
  it('reprices from the catalog and ignores a tampered client unitAmount', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 2, unitAmount: 1, title: 'HACKED $0.01' }],
      catalogRows: [row()],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items[0].unitAmount).toBe(5000); // authoritative, not the client's 1
    expect(res.items[0].title).toBe('Widget'); // authoritative, not the client's title
    expect(res.items[0].quantity).toBe(2);
  });

  it('rejects an item id that is not in the catalog', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ghost', quantity: 1 }],
      catalogRows: [row()],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.badItemId).toBe('ghost');
  });

  it('rejects an item belonging to a different merchant (cross-store tampering)', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1 }],
      catalogRows: [row({ merchant_id: 'someone-else' })],
    });
    expect(res.ok).toBe(false);
  });

  it('rejects a non-active (draft/archived) item', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1 }],
      catalogRows: [row({ status: 'draft' })],
    });
    expect(res.ok).toBe(false);
  });

  it('rejects an item with a missing/invalid price rather than charging 0', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1 }],
      catalogRows: [row({ price_cents: null })],
    });
    expect(res.ok).toBe(false);
  });

  it('allows a legitimately free (0-cent) item', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1 }],
      catalogRows: [row({ price_cents: 0 })],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items[0].unitAmount).toBe(0);
  });

  it('floors quantity and rejects <1 or absurd quantities', () => {
    expect(authorizeCheckoutItems({ merchantId: M, requested: [{ catalogItemId: 'ci-1', quantity: 0 }], catalogRows: [row()] }).ok).toBe(false);
    expect(authorizeCheckoutItems({ merchantId: M, requested: [{ catalogItemId: 'ci-1', quantity: 100000 }], catalogRows: [row()] }).ok).toBe(false);
    const ok = authorizeCheckoutItems({ merchantId: M, requested: [{ catalogItemId: 'ci-1', quantity: 3.9 as any }], catalogRows: [row()] });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.items[0].quantity).toBe(3); // floored
  });

  it('reprices a multi-line cart and preserves per-line catalog prices', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [
        { catalogItemId: 'ci-1', quantity: 1, unitAmount: 1 },
        { catalogItemId: 'ci-2', quantity: 3, unitAmount: 1 },
      ],
      catalogRows: [row(), row({ id: 'ci-2', title: 'Gadget', price_cents: 250 })],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items.map((i) => [i.catalogItemId, i.unitAmount, i.quantity])).toEqual([
      ['ci-1', 5000, 1],
      ['ci-2', 250, 3],
    ]);
  });

  it('fails closed on an empty cart', () => {
    expect(authorizeCheckoutItems({ merchantId: M, requested: [], catalogRows: [row()] }).ok).toBe(false);
  });
});
