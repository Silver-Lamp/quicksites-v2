/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/assembleDraft.test.ts
//
// buildRebuildTemplate wires a RebuildSpec into a template payload. The footer
// renders address/phone/map from template.data.meta.contact (NOT the location
// block), so assembly must mirror the real contact info there too.

import { buildRebuildTemplate, wireCatalogIntoTemplate } from '@/lib/rebuild/assembleDraft';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';
import type { ProductSpec } from '@/lib/rebuild/importShopify';

function product(over: Partial<ProductSpec> = {}): ProductSpec {
  return {
    title: 'Who Calls the Shots?',
    handle: 'who-calls-the-shots-game',
    description: 'A card game of medical trivia.',
    priceCents: 2999,
    compareAtCents: 4999,
    currency: 'USD',
    images: ['https://cdn.shopify.com/a.png', 'https://cdn.shopify.com/b.png'],
    variants: [{ title: 'Default', priceCents: 2999 }],
    options: [],
    requiresShipping: true,
    productUrl: 'https://meddzelle.com/products/who-calls-the-shots-game',
    productType: 'Card Game',
    ...over,
  };
}

function baseSpec(overrides: Partial<RebuildSpec> = {}): RebuildSpec {
  return {
    businessName: "Eyman's Pizza",
    industryKey: 'restaurant' as any,
    industryLabel: 'Restaurant',
    headline: 'Fresh Pizza',
    subheadline: 'Hand-tossed daily',
    about: 'A neighborhood pizzeria.',
    services: [],
    faqs: [],
    contact: { phone: '253-555-0100', address: '123 Main St, Auburn, WA', email: 'hi@eymans.com' },
    ...overrides,
  };
}

describe('buildRebuildTemplate', () => {
  it('mirrors contact info into meta.contact for the footer', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec() });
    // The scaffold ships a null-filled meta.contact (why the footer showed blanks);
    // assembly must fill the real values over it.
    expect(tpl.data.meta.contact).toMatchObject({
      phone: '253-555-0100',
      address: '123 Main St, Auburn, WA',
      email: 'hi@eymans.com',
    });
  });

  it('still populates the location block with the same contact info', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec() });
    const loc = tpl.data.pages[0].blocks.find((b: any) => b?.type === 'location');
    expect(loc?.content?.address).toBe('123 Main St, Auburn, WA');
    expect(loc?.content?.phone).toBe('253-555-0100');
  });

  it('leaves meta.contact fields empty when the spec has no contact', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec({ contact: undefined }) });
    expect(tpl.data.meta.contact?.address ?? null).toBeNull();
    expect(tpl.data.meta.contact?.phone ?? null).toBeNull();
  });

  it('builds a products_grid from imported products (real title/price/image)', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec({ products: [product()] }) });
    const grid = tpl.data.pages[0].blocks.find((b: any) => b?.type === 'products_grid');
    expect(grid).toBeTruthy();
    expect(grid.content.columns).toBe(1); // one product → single column
    expect(grid.content.products[0]).toMatchObject({
      id: 'who-calls-the-shots-game', // handle placeholder until wired
      title: 'Who Calls the Shots?',
      price_cents: 2999,
      image_url: 'https://cdn.shopify.com/a.png',
    });
    // The generic services block is replaced by the storefront.
    expect(tpl.data.pages[0].blocks.find((b: any) => b?.type === 'services')).toBeFalsy();
  });

  it('leads the hero with the product image when no scraped hero exists', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec({ products: [product()] }) });
    const hero = tpl.data.pages[0].blocks[0];
    expect(hero.content.image_url).toBe('https://cdn.shopify.com/a.png');
  });
});

describe('wireCatalogIntoTemplate', () => {
  it('wires real catalog ids + merchant into the grid and meta.ecom', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec({ products: [product(), product({ handle: 'tee', title: 'Tee' })] }) });
    wireCatalogIntoTemplate(tpl.data, 'merch_1', {
      'who-calls-the-shots-game': 'cat_abc',
      tee: 'cat_def',
    });
    const grid = tpl.data.pages[0].blocks.find((b: any) => b?.type === 'products_grid');
    expect(grid.content.productIds).toEqual(['cat_abc', 'cat_def']);
    expect(grid.content.products.map((p: any) => p.id)).toEqual(['cat_abc', 'cat_def']);
    expect(tpl.data.meta.ecom.merchant_id).toBe('merch_1');
  });

  it('drops products that failed to provision (no id mapped)', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec({ products: [product(), product({ handle: 'tee', title: 'Tee' })] }) });
    wireCatalogIntoTemplate(tpl.data, 'merch_1', { 'who-calls-the-shots-game': 'cat_abc' });
    const grid = tpl.data.pages[0].blocks.find((b: any) => b?.type === 'products_grid');
    expect(grid.content.productIds).toEqual(['cat_abc']);
    expect(grid.content.products).toHaveLength(1);
  });
});
