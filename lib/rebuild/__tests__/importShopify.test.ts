/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/importShopify.test.ts
//
// The deterministic Shopify catalog importer. Fixture mirrors the real shape of
// meddzelle.com/products.json (a single $29.99 card game, compare-at $49.99, 10
// images) so the mapper stays honest against actual Shopify output.

import {
  detectShopifyFromHtml,
  dollarsToCents,
  htmlToText,
  mapShopifyProduct,
  parseShopifyProducts,
  importShopifyProducts,
} from '@/lib/rebuild/importShopify';

const PRODUCT = {
  id: 9860371218743,
  title: 'Who Calls the Shots? The Trivia Card Game',
  handle: 'who-calls-the-shots-game',
  body_html:
    '<div><strong>FREE SHIPPING!</strong><br><br>A card game of medical trivia.</div>' +
    '<ul><li>Medical Trivia: test your knowledge.</li><li>Action Cards: draw &amp; act.</li></ul>',
  vendor: 'Meddzelle',
  product_type: 'Card Game',
  variants: [
    { id: 1, title: 'Default Title', option1: 'Default Title', price: '29.99', compare_at_price: '49.99', sku: 'WCTS-1', available: true, requires_shipping: true },
  ],
  images: [
    { src: 'https://cdn.shopify.com/s/files/1/1.png?v=1', position: 1 },
    { src: 'https://cdn.shopify.com/s/files/1/2.png?v=1', position: 2 },
    { src: 'https://cdn.shopify.com/s/files/1/2.png?v=1', position: 3 }, // dup dropped
  ],
  options: [{ name: 'Title', position: 1, values: ['Default Title'] }],
};

function stubFetch(body: any, opts: { ok?: boolean; ctype?: string } = {}): typeof fetch {
  return (async () =>
    ({
      ok: opts.ok ?? true,
      status: opts.ok === false ? 404 : 200,
      url: 'https://meddzelle.com/products.json',
      headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? (opts.ctype ?? 'application/json') : null) },
      body: null,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    }) as any) as unknown as typeof fetch;
}

describe('dollarsToCents', () => {
  it('parses dollar strings and rejects junk', () => {
    expect(dollarsToCents('29.99')).toBe(2999);
    expect(dollarsToCents('49.99')).toBe(4999);
    expect(dollarsToCents('$1,299.00')).toBe(129900);
    expect(dollarsToCents('0')).toBe(0);
    expect(dollarsToCents(null)).toBeUndefined();
    expect(dollarsToCents('free')).toBeUndefined();
  });
});

describe('htmlToText', () => {
  it('strips markup, keeps text, decodes entities', () => {
    const t = htmlToText(PRODUCT.body_html);
    expect(t).toContain('FREE SHIPPING!');
    expect(t).toContain('A card game of medical trivia.');
    expect(t).toContain('draw & act'); // &amp; decoded
    expect(t).not.toMatch(/<[^>]+>/); // no tags survive
  });
});

describe('detectShopifyFromHtml', () => {
  it('detects Shopify signals', () => {
    expect(detectShopifyFromHtml('<img src="https://cdn.shopify.com/x.png">')).toBe(true);
    expect(detectShopifyFromHtml('<footer>Powered by Shopify</footer>')).toBe(true);
    expect(detectShopifyFromHtml('<html><body>just a plain site</body></html>')).toBe(false);
  });
});

describe('mapShopifyProduct', () => {
  it('maps price, compare-at, images, and product url', () => {
    const p = mapShopifyProduct(PRODUCT, 'https://meddzelle.com')!;
    expect(p.title).toBe('Who Calls the Shots? The Trivia Card Game');
    expect(p.priceCents).toBe(2999);
    expect(p.compareAtCents).toBe(4999);
    expect(p.currency).toBe('USD');
    expect(p.images).toEqual([
      'https://cdn.shopify.com/s/files/1/1.png?v=1',
      'https://cdn.shopify.com/s/files/1/2.png?v=1',
    ]); // dedup
    expect(p.productType).toBe('Card Game');
    expect(p.requiresShipping).toBe(true);
    expect(p.productUrl).toBe('https://meddzelle.com/products/who-calls-the-shots-game');
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0].priceCents).toBe(2999);
    // "Default Title" is noise — dropped from variant options and the options list.
    expect(p.variants[0].options).toBeUndefined();
    expect(p.options).toEqual([]);
  });

  it('drops a compare-at that is not actually higher', () => {
    const p = mapShopifyProduct(
      { ...PRODUCT, variants: [{ title: 'x', price: '29.99', compare_at_price: '29.99' }] },
      null,
    )!;
    expect(p.compareAtCents).toBeUndefined();
  });

  it('captures shipping weight (grams) from the cheapest variant', () => {
    const p = mapShopifyProduct(
      { ...PRODUCT, variants: [{ title: 'x', price: '29.99', grams: 544, requires_shipping: true }] },
      null,
    )!;
    expect(p.grams).toBe(544);
    expect(p.requiresShipping).toBe(true);
    expect(p.variants[0].grams).toBe(544);
  });

  it('captures SKU + barcode (variant-level and representative for a plain item)', () => {
    const p = mapShopifyProduct(
      { ...PRODUCT, variants: [{ title: 'x', price: '29.99', sku: 'WCTS-1', barcode: '012345678905' }] },
      null,
    )!;
    expect(p.variants[0].sku).toBe('WCTS-1');
    expect(p.variants[0].barcode).toBe('012345678905');
    expect(p.sku).toBe('WCTS-1'); // representative (plain item)
    expect(p.barcode).toBe('012345678905');
  });

  it('returns null for a product with no priced variant', () => {
    expect(mapShopifyProduct({ title: 'X', variants: [] }, null)).toBeNull();
    expect(mapShopifyProduct({ title: '', variants: [{ price: '1' }] }, null)).toBeNull();
  });

  it('keeps real multi-variant options', () => {
    const p = mapShopifyProduct(
      {
        title: 'Tee',
        handle: 'tee',
        variants: [
          { title: 'Small', option1: 'Small', price: '20.00' },
          { title: 'Large', option1: 'Large', price: '22.00' },
        ],
        options: [{ name: 'Size', values: ['Small', 'Large'] }],
      },
      'https://shop.example',
    )!;
    expect(p.priceCents).toBe(2000); // lowest variant
    expect(p.variants.map((v) => v.options)).toEqual([['Small'], ['Large']]);
    expect(p.options).toEqual([{ name: 'Size', values: ['Small', 'Large'] }]);
  });
});

describe('importShopifyProducts', () => {
  it('fetches and parses a live-shaped catalog', async () => {
    const products = await importShopifyProducts('https://meddzelle.com', stubFetch({ products: [PRODUCT] }));
    expect(products).toHaveLength(1);
    expect(products[0].priceCents).toBe(2999);
  });

  it('returns [] for a non-Shopify site (404)', async () => {
    expect(await importShopifyProducts('https://plain.example', stubFetch('Not found', { ok: false }))).toEqual([]);
  });

  it('returns [] for an HTML (non-JSON) response', async () => {
    expect(
      await importShopifyProducts('https://plain.example', stubFetch('<html></html>', { ctype: 'text/html' })),
    ).toEqual([]);
  });

  it('returns [] for a blocked/internal host without throwing', async () => {
    expect(await importShopifyProducts('http://169.254.169.254', stubFetch({ products: [PRODUCT] }))).toEqual([]);
  });

  it('parseShopifyProducts skips unpriced entries', () => {
    const out = parseShopifyProducts({ products: [PRODUCT, { title: 'No price', variants: [] }] }, null);
    expect(out).toHaveLength(1);
  });
});
