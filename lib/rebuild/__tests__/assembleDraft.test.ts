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

  it('pre-picks site type + industry so the editor does not re-ask', () => {
    const concrete = buildRebuildTemplate({ spec: baseSpec({ industryKey: 'restaurant' as any, industryLabel: 'Restaurant' }) });
    expect(concrete.data.meta.site_type).toBe('small_business');
    expect(concrete.data.meta.industry).toBe('restaurant');
    expect(concrete.data.meta.industry_other).toBeUndefined();

    // "Other" industries seed the free-text category so the picker treats it as chosen.
    const other = buildRebuildTemplate({ spec: baseSpec({ industryKey: 'other' as any, industryLabel: 'Card Game' }) });
    expect(other.data.meta.industry).toBe('other');
    expect(other.data.meta.industry_other).toBe('Card Game');
  });

  it('matches the source site color mode when provided (overrides the default)', () => {
    const light = buildRebuildTemplate({ spec: baseSpec(), colorMode: 'light' });
    expect(light.color_mode).toBe('light');
    expect(light.data.color_mode).toBe('light');
    const dark = buildRebuildTemplate({ spec: baseSpec(), colorMode: 'dark' });
    expect(dark.color_mode).toBe('dark');
    expect(dark.data.color_mode).toBe('dark');
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

describe('story sections', () => {
  const story = [
    { heading: 'Created by 2 NPs', body: 'From Texas.' },
    { heading: 'Play your shift', body: 'Day, swing, night.' },
    { heading: 'For every player', body: 'PATIENT cards too.' },
  ];

  it('builds a story block, pairing each section with a gallery image (in order)', () => {
    const tpl = buildRebuildTemplate({
      spec: baseSpec({ story }),
      galleryImages: ['https://cdn/a.png', 'https://cdn/b.png'],
    });
    const block = tpl.data.pages[0].blocks.find((b: any) => b?.type === 'story');
    expect(block).toBeTruthy();
    expect(block.content.sections).toHaveLength(3);
    expect(block.content.sections[0]).toMatchObject({ heading: 'Created by 2 NPs', image_url: 'https://cdn/a.png' });
    expect(block.content.sections[1].image_url).toBe('https://cdn/b.png');
    // Third section has no image left → renders text-only.
    expect(block.content.sections[2].image_url).toBe('');
  });

  it('places the story block before the contact form (restaurant scaffolds have no FAQ)', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec({ story }) });
    const types = tpl.data.pages[0].blocks.map((b: any) => b?.type);
    expect(types.indexOf('story')).toBeGreaterThanOrEqual(0);
    // FAQ was dropped from the restaurant scaffold (2026-07); the insertion anchor
    // falls back to the contact form, keeping the story above the page tail.
    expect(types).not.toContain('faq');
    expect(types.indexOf('story')).toBeLessThan(types.indexOf('contact_form'));
  });

  it('excludes the hero image from story images (no duplication)', () => {
    const tpl = buildRebuildTemplate({
      spec: baseSpec({ story: [story[0]], products: [product()] }),
      heroImage: 'https://cdn.shopify.com/a.png', // same as product's first image
      galleryImages: ['https://cdn.shopify.com/a.png', 'https://cdn.shopify.com/b.png'],
    });
    const block = tpl.data.pages[0].blocks.find((b: any) => b?.type === 'story');
    expect(block.content.sections[0].image_url).toBe('https://cdn.shopify.com/b.png');
  });
});

describe('copy versions (original vs generated)', () => {
  it('snapshots original + generated copy into meta.copy for per-block revert', () => {
    const tpl = buildRebuildTemplate({
      spec: baseSpec({
        headline: 'AI Headline',
        services: ['A', 'B'],
        original: { headline: 'Old Headline', subheadline: 'Old tagline', services: ['X', 'Y'] },
      }),
    });
    expect(tpl.data.meta.copy.original).toMatchObject({ headline: 'Old Headline', services: ['X', 'Y'] });
    expect(tpl.data.meta.copy.generated).toMatchObject({ headline: 'AI Headline', services: ['A', 'B'] });
  });

  it('omits meta.copy when no original was captured', () => {
    const tpl = buildRebuildTemplate({ spec: baseSpec({ original: undefined }) });
    expect(tpl.data.meta.copy).toBeUndefined();
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
