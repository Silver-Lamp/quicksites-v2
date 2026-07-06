// lib/commerce/__tests__/menuOrderChain.test.ts
//
// The money-critical assertion behind /api/admin/commerce/menu-demo, but pure (no
// DB): a menu with a "choose one" item → catalog rows/variants → checkout must
// reprice the CHOSEN option (Large $12), never the cheaper base ($8). If this ever
// regresses, a customer could be charged the wrong amount.

import { buildCatalogRowsFromMenu } from '@/lib/commerce/menuCatalog';
import { normalizeVariants } from '@/lib/commerce/variants';
import { authorizeCheckoutItems } from '@/lib/commerce/checkoutItems';

function seed() {
  const rows = buildCatalogRowsFromMenu([
    { name: 'Lunch', items: [{ name: 'House Salad', price_cents: 900 }] },
    { name: 'Shareables', items: [{ name: 'Wings', options: [{ label: 'Small', price_cents: 800 }, { label: 'Large', price_cents: 1200 }] }] },
  ]);
  const wingsRow = rows.find((r) => r.name === 'Wings')!;
  const norm = normalizeVariants({
    variants: wingsRow.variants!.map((v) => ({ label: v.label, priceCents: v.price_cents })),
    fallbackBaseCents: wingsRow.price_cents,
  });
  // Catalog rows as they'd be inserted by publish-catalog.
  const catalogRows = [
    { id: 'salad', merchant_id: 'm1', title: 'House Salad', price_cents: 900, status: 'active', metadata: { site_slug: 's', category: 'Lunch' } },
    { id: 'wings', merchant_id: 'm1', title: 'Wings', price_cents: norm.basePriceCents, status: 'active', metadata: { site_slug: 's', category: 'Shareables', variants: norm.variants, variant_options: norm.variant_options } },
  ];
  return { wingsRow, norm, catalogRows };
}

describe('menu → catalog → checkout reprice', () => {
  it('reprices the chosen Large variant to $12, not the $8 base', () => {
    const { wingsRow, norm, catalogRows } = seed();
    const largeId = norm.variants.find((v) => v.label === 'Large')!.id;

    const priced = authorizeCheckoutItems({
      merchantId: 'm1',
      requested: [
        { catalogItemId: 'salad', quantity: 1 },
        { catalogItemId: 'wings', variantId: largeId, quantity: 1 },
      ],
      catalogRows: catalogRows as any,
    });

    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(wingsRow.price_cents).toBe(800); // base = cheapest option
    expect(priced.items.find((i) => i.catalogItemId === 'salad')!.unitAmount).toBe(900);
    expect(priced.items.find((i) => i.catalogItemId === 'wings')!.unitAmount).toBe(1200); // the reprice that matters
  });

  it('rejects a variant item ordered without choosing a variant', () => {
    const { catalogRows } = seed();
    const priced = authorizeCheckoutItems({
      merchantId: 'm1',
      requested: [{ catalogItemId: 'wings', quantity: 1 }], // no variantId
      catalogRows: catalogRows as any,
    });
    expect(priced.ok).toBe(false);
  });
});
