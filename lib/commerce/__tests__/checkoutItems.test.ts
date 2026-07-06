// lib/commerce/__tests__/checkoutItems.test.ts
//
// Server-side price authority for storefront checkout (gap #7). The load-bearing
// property: the price charged comes from catalog_items, never from the request —
// so a tampered unitAmount can't turn a $50 product into a $0.01 purchase.

import {
  authorizeCheckoutItems,
  readVariantOptions,
  resolveVariantByOptions,
  type CatalogRow,
  type CatalogVariant,
} from '../checkoutItems';

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

  it('adds selected add-on prices to the unit amount (server-priced by id)', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1, addonIds: ['cheese', 'bacon'] }],
      catalogRows: [
        row({
          metadata: {
            addons: [
              { id: 'cheese', label: 'Extra cheese', price_cents: 100 },
              { id: 'bacon', label: 'Bacon', price_cents: 200 },
              { id: 'avo', label: 'Avocado', price_cents: 250 },
            ],
          },
        }),
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items[0].unitAmount).toBe(5300); // 5000 base + 100 + 200
    expect((res.items[0].metadata as any).addon_ids).toEqual(['cheese', 'bacon']);
    expect(res.items[0].title).toContain('Extra cheese');
  });

  it('adds add-ons on top of the selected variant price', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1, variantId: 'lg', addonIds: ['cheese'] }],
      catalogRows: [
        row({
          price_cents: 800,
          metadata: {
            variants: [{ id: 'lg', label: 'Large', price_cents: 1200, status: 'active' }],
            addons: [{ id: 'cheese', label: 'Extra cheese', price_cents: 150 }],
          },
        }),
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items[0].unitAmount).toBe(1350); // 1200 variant + 150 add-on (not the 800 base)
  });

  it('rejects an unknown add-on id (tamper guard)', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1, addonIds: ['not-a-real-addon'] }],
      catalogRows: [row({ metadata: { addons: [{ id: 'cheese', label: 'Extra cheese', price_cents: 100 }] } })],
    });
    expect(res.ok).toBe(false);
  });

  it('is unchanged when no add-ons are requested', () => {
    const res = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1 }],
      catalogRows: [row({ metadata: { addons: [{ id: 'cheese', label: 'Extra cheese', price_cents: 100 }] } })],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items[0].unitAmount).toBe(5000);
    expect((res.items[0].metadata as any).addon_ids).toBeUndefined();
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

  it('enforces item-level stock on a plain (variant-less) item', () => {
    const soldOut = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 1 }],
      catalogRows: [row({ metadata: { stock: 0 } })],
    });
    expect(soldOut.ok).toBe(false);

    const ok = authorizeCheckoutItems({
      merchantId: M,
      requested: [{ catalogItemId: 'ci-1', quantity: 2 }],
      catalogRows: [row({ metadata: { stock: 2 } })],
    });
    expect(ok.ok).toBe(true);
  });

  describe('variants', () => {
    const withVariants = (variants: any[]) =>
      row({ price_cents: null, metadata: { variants } });

    it('prices from the selected variant, not the base item or the client', () => {
      const res = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 1, variantId: 'lg', unitAmount: 1 }],
        catalogRows: [withVariants([
          { id: 'sm', label: 'Small', price_cents: 1000 },
          { id: 'lg', label: 'Large', price_cents: 1500 },
        ])],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.items[0].unitAmount).toBe(1500);
      expect(res.items[0].title).toBe('Widget — Large');
      expect(res.items[0].metadata).toMatchObject({ variant_id: 'lg', variant_label: 'Large' });
    });

    it('requires a variant selection when the item has variants', () => {
      const res = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 1 }], // no variantId
        catalogRows: [withVariants([{ id: 'sm', label: 'Small', price_cents: 1000 }])],
      });
      expect(res.ok).toBe(false);
    });

    it('rejects an unknown or inactive variant id', () => {
      const unknown = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 1, variantId: 'ghost' }],
        catalogRows: [withVariants([{ id: 'sm', label: 'Small', price_cents: 1000 }])],
      });
      expect(unknown.ok).toBe(false);

      const inactive = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 1, variantId: 'sm' }],
        catalogRows: [withVariants([{ id: 'sm', label: 'Small', price_cents: 1000, status: 'inactive' }])],
      });
      expect(inactive.ok).toBe(false);
    });

    it('ignores a stray variantId on an item that has no variants', () => {
      const res = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 1, variantId: 'stale' }],
        catalogRows: [row()], // no variants, price 5000
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.items[0].unitAmount).toBe(5000);
    });

    it('rejects a sold-out (stock 0) variant', () => {
      const res = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 1, variantId: 'sm' }],
        catalogRows: [withVariants([{ id: 'sm', label: 'Small', price_cents: 1000, stock: 0 }])],
      });
      expect(res.ok).toBe(false);
    });

    it('rejects ordering more than a variant has in stock', () => {
      const res = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 5, variantId: 'sm' }],
        catalogRows: [withVariants([{ id: 'sm', label: 'Small', price_cents: 1000, stock: 3 }])],
      });
      expect(res.ok).toBe(false);
    });

    it('allows up to the tracked stock, and unlimited when untracked', () => {
      const exact = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 3, variantId: 'sm' }],
        catalogRows: [withVariants([{ id: 'sm', label: 'Small', price_cents: 1000, stock: 3 }])],
      });
      expect(exact.ok).toBe(true);
      const untracked = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 999, variantId: 'sm' }],
        catalogRows: [withVariants([{ id: 'sm', label: 'Small', price_cents: 1000 }])],
      });
      expect(untracked.ok).toBe(true);
    });

    it('prices a multi-axis SKU by its id (checkout is unchanged for grids)', () => {
      // A 2-axis product (Size × Color) is still a flat list of SKUs, each an id.
      const res = authorizeCheckoutItems({
        merchantId: M,
        requested: [{ catalogItemId: 'ci-1', quantity: 1, variantId: 'm-red', unitAmount: 1 }],
        catalogRows: [row({
          price_cents: null,
          metadata: {
            variant_options: [{ name: 'Size', values: ['S', 'M'] }, { name: 'Color', values: ['Red', 'Blue'] }],
            variants: [
              { id: 'm-red', label: 'M / Red', price_cents: 2200, options: { Size: 'M', Color: 'Red' } },
              { id: 'm-blue', label: 'M / Blue', price_cents: 2000, options: { Size: 'M', Color: 'Blue' } },
            ],
          },
        })],
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.items[0].unitAmount).toBe(2200);
      expect(res.items[0].title).toBe('Widget — M / Red');
    });
  });
});

describe('readVariantOptions', () => {
  it('reads well-formed axes and drops malformed ones', () => {
    const axes = readVariantOptions({
      variant_options: [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Red'] },
        { name: 'Bad', values: [] }, // dropped: no values
        { name: 'AlsoBad' }, // dropped: no values array
      ],
    });
    expect(axes).toEqual([
      { name: 'Size', values: ['S', 'M', 'L'] },
      { name: 'Color', values: ['Red'] },
    ]);
  });

  it('returns [] when there are no axes (flat / legacy variants)', () => {
    expect(readVariantOptions({ variants: [{ id: 'a' }] })).toEqual([]);
    expect(readVariantOptions(null)).toEqual([]);
  });
});

describe('resolveVariantByOptions', () => {
  const variants: CatalogVariant[] = [
    { id: 's-red', label: 'S / Red', price_cents: 1000, options: { Size: 'S', Color: 'Red' } },
    { id: 'm-red', label: 'M / Red', price_cents: 1200, options: { Size: 'M', Color: 'Red' } },
    { id: 'm-blue', label: 'M / Blue', price_cents: 1300, options: { Size: 'M', Color: 'Blue' } },
  ];

  it('maps a full axis selection to the matching SKU', () => {
    expect(resolveVariantByOptions(variants, { Size: 'M', Color: 'Blue' })?.id).toBe('m-blue');
  });

  it('returns undefined for an unoffered combination (e.g. S / Blue)', () => {
    expect(resolveVariantByOptions(variants, { Size: 'S', Color: 'Blue' })).toBeUndefined();
  });

  it('returns undefined for an empty selection', () => {
    expect(resolveVariantByOptions(variants, {})).toBeUndefined();
  });
});
