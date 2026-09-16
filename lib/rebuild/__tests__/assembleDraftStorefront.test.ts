/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/assembleDraftStorefront.test.ts
//
// A detected store that we could NOT read must still come out as a store: an empty Shop block on
// the page and the gap recorded in meta.ecom. Before this, such a site (FOYTEA on Shoptop,
// 2026-09-15) assembled as a brochure with nothing on it saying a shop had been there.

import { buildRebuildTemplate } from '@/lib/rebuild/assembleDraft';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';
import type { ProductSpec } from '@/lib/rebuild/importShopify';

function product(): ProductSpec {
  return {
    title: 'Fortune Tee',
    handle: 'fortune-tee',
    description: 'A tee.',
    priceCents: 2999,
    currency: 'USD',
    images: ['https://cdn.example/tee.jpg'],
    variants: [{ title: 'Default', priceCents: 2999 }],
    options: [],
    requiresShipping: true,
    productUrl: 'https://foytea.com/products/fortune-tee',
  };
}

function spec(overrides: Partial<RebuildSpec> = {}): RebuildSpec {
  return {
    businessName: 'FOYTEA',
    industryKey: 'other' as any,
    industryLabel: 'Apparel brand',
    headline: 'Fortune Of Your Brand',
    subheadline: 'Streetwear',
    about: 'An apparel brand.',
    services: ['Tees', 'Hoodies'],
    faqs: [],
    ...overrides,
  };
}

const blocksOf = (tpl: any): any[] => tpl.data.pages[0].blocks;
const gridsOf = (tpl: any) => blocksOf(tpl).filter((b) => b.type === 'products_grid');

describe('a detected store with no readable products', () => {
  const tpl = buildRebuildTemplate({
    spec: spec({ storefront: { platform: 'shoptop', productsReadable: false } }),
  });

  it('places exactly one EMPTY Shop block right after the hero', () => {
    const grids = gridsOf(tpl);
    expect(grids).toHaveLength(1);
    expect(blocksOf(tpl)[1].type).toBe('products_grid');
    expect(grids[0].content.title).toBe('Shop');
    expect(grids[0].content.productIds).toEqual([]);
    expect(grids[0].content.products).toEqual([]);
  });

  it('keeps the services block — categories are still useful content', () => {
    expect(blocksOf(tpl).some((b) => b.type === 'services')).toBe(true);
  });

  it('records the gap in meta.ecom so the editor and analytics can see it', () => {
    expect(tpl.data.meta.ecom).toMatchObject({
      source_platform: 'shoptop',
      import_status: 'no_readable_products',
      products_imported: 0,
    });
  });
});

describe('a store WITH imported products', () => {
  const tpl = buildRebuildTemplate({
    spec: spec({ storefront: { platform: 'shopify', productsReadable: true }, products: [product()] }),
  });

  it('builds the real grid once — no extra empty Shop block', () => {
    const grids = gridsOf(tpl);
    expect(grids).toHaveLength(1);
    expect(grids[0].content.products).toHaveLength(1);
  });

  it('records import_status = snapshot with the count (the route upgrades it to imported once ids are wired)', () => {
    expect(tpl.data.meta.ecom).toMatchObject({
      source_platform: 'shopify',
      import_status: 'snapshot',
      products_imported: 1,
    });
  });

  it('keeps currency + product_url on the inline snapshot so the gallery can show them', () => {
    const [grid] = gridsOf(tpl);
    expect(grid.content.products[0]).toMatchObject({ currency: 'USD', product_url: 'https://foytea.com/products/fortune-tee' });
  });
});

describe('a site that is not a store', () => {
  it('gets no Shop block and no meta.ecom', () => {
    const tpl = buildRebuildTemplate({ spec: spec() });
    expect(gridsOf(tpl)).toHaveLength(0);
    expect(tpl.data.meta.ecom).toBeUndefined();
  });
});
