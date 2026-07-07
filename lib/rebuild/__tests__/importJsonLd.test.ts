/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/importJsonLd.test.ts
//
// Non-Shopify product extraction from schema.org Product JSON-LD + OpenGraph product
// meta. Fixtures mirror real WooCommerce / Squarespace output shapes (single Product,
// @graph-wrapped, ItemList of products, AggregateOffer).

import { parseJsonLdProducts, parseOgProduct, productsFromScrape } from '@/lib/rebuild/importJsonLd';

const PAGE = 'https://shop.example/store';

describe('parseJsonLdProducts', () => {
  it('maps a plain WooCommerce-style Product with a single Offer', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Handmade Mug',
      description: '<p>A <strong>ceramic</strong> mug.</p>',
      category: 'Kitchen',
      brand: { '@type': 'Brand', name: 'ClayCo' },
      image: ['https://cdn.example/mug-1.jpg', 'https://cdn.example/mug-2.jpg'],
      offers: { '@type': 'Offer', price: '24.00', priceCurrency: 'USD', url: 'https://shop.example/mug' },
    };
    const [p] = parseJsonLdProducts([ld], PAGE);
    expect(p.title).toBe('Handmade Mug');
    expect(p.priceCents).toBe(2400);
    expect(p.currency).toBe('USD');
    expect(p.vendor).toBe('ClayCo');
    expect(p.productType).toBe('Kitchen');
    expect(p.description).toContain('ceramic'); // html stripped
    expect(p.description).not.toMatch(/<[^>]+>/);
    expect(p.images).toEqual(['https://cdn.example/mug-1.jpg', 'https://cdn.example/mug-2.jpg']);
    expect(p.productUrl).toBe('https://shop.example/mug');
  });

  it('unwraps @graph and reads AggregateOffer lowPrice', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Store' },
        {
          '@type': 'Product',
          name: 'Poster',
          image: { '@type': 'ImageObject', url: 'https://cdn.example/poster.jpg' },
          offers: { '@type': 'AggregateOffer', lowPrice: '12.50', highPrice: '30.00', priceCurrency: 'EUR' },
        },
      ],
    };
    const [p] = parseJsonLdProducts([ld], PAGE);
    expect(p.title).toBe('Poster');
    expect(p.priceCents).toBe(1250); // lowPrice
    expect(p.currency).toBe('EUR');
    expect(p.images).toEqual(['https://cdn.example/poster.jpg']);
  });

  it('reads an ItemList of products and dedupes by handle', () => {
    const ld = {
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', item: { '@type': 'Product', name: 'A', offers: { price: '10' } } },
        { '@type': 'ListItem', item: { '@type': 'Product', name: 'B', offers: { price: '20' } } },
        { '@type': 'ListItem', item: { '@type': 'Product', name: 'A', offers: { price: '10' } } }, // dup
      ],
    };
    const out = parseJsonLdProducts([ld], PAGE);
    expect(out.map((p) => p.title)).toEqual(['A', 'B']);
  });

  it('picks the lowest price across an Offer array', () => {
    const ld = { '@type': 'Product', name: 'Tee', offers: [{ price: '25' }, { price: '19.99' }, { price: '30' }] };
    const [p] = parseJsonLdProducts([ld], PAGE);
    expect(p.priceCents).toBe(1999);
  });

  it('skips Product nodes with no price and non-Product types', () => {
    expect(parseJsonLdProducts([{ '@type': 'Product', name: 'No price' }], PAGE)).toEqual([]);
    expect(parseJsonLdProducts([{ '@type': 'Article', name: 'Blog post' }], PAGE)).toEqual([]);
  });
});

describe('parseOgProduct', () => {
  it('builds one product from OpenGraph product meta', () => {
    const out = parseOgProduct({
      productMeta: { priceAmount: '39.95', priceCurrency: 'usd' },
      title: 'OG Widget',
      image: 'https://cdn.example/og.jpg',
      description: 'A widget.',
      pageUrl: PAGE,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: 'OG Widget', priceCents: 3995, currency: 'USD', images: ['https://cdn.example/og.jpg'] });
  });

  it('returns [] without a price or title', () => {
    expect(parseOgProduct({ productMeta: null, title: 'X', image: null, description: null, pageUrl: PAGE })).toEqual([]);
    expect(parseOgProduct({ productMeta: { priceAmount: '10' }, title: null, image: null, description: null, pageUrl: PAGE })).toEqual([]);
  });
});

describe('productsFromScrape', () => {
  const base: any = { finalUrl: PAGE, businessName: 'Store', title: 'Store', heroImage: null, description: null, structuredData: [], productMeta: null };

  it('prefers JSON-LD over og meta', () => {
    const out = productsFromScrape({
      ...base,
      structuredData: [{ '@type': 'Product', name: 'LD Product', offers: { price: '5' } }],
      productMeta: { priceAmount: '99' },
    });
    expect(out.map((p) => p.title)).toEqual(['LD Product']);
  });

  it('falls back to og meta when there is no JSON-LD product', () => {
    const out = productsFromScrape({ ...base, heroImage: 'https://cdn.example/h.jpg', productMeta: { priceAmount: '15.00' } });
    expect(out).toHaveLength(1);
    expect(out[0].priceCents).toBe(1500);
  });

  it('returns [] for a non-commerce page', () => {
    expect(productsFromScrape(base)).toEqual([]);
  });
});
