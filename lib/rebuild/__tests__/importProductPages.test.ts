/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/importProductPages.test.ts
//
// Products live on product PAGES. The homepage of a WooCommerce / Squarespace store carries
// Organization JSON-LD; the Product JSON-LD is one link away. This crawler follows those links.

import { pickProductPageCandidates, scrapeProductPages } from '@/lib/rebuild/importProductPages';

const scraped: any = {
  sourceUrl: 'https://shop.example/',
  finalUrl: 'https://shop.example/',
  links: [
    { label: 'Home', href: 'https://shop.example/' },
    { label: 'Mug', href: 'https://shop.example/product/mug' },
    { label: 'Bowl', href: 'https://shop.example/product/bowl/' },
    { label: 'Mug again', href: 'https://shop.example/product/MUG' }, // same path, different case → deduped
    { label: 'Kitchen', href: 'https://shop.example/collections/kitchen' },
    { label: 'About', href: 'https://shop.example/about' }, // not a product page
    { label: 'Elsewhere', href: 'https://other.example/product/x' }, // cross-origin → skipped
    { label: 'Cart', href: 'https://shop.example/cart' }, // not a product page
  ],
};

const productLd = (name: string, price: string, img: string) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    image: [img],
    offers: { '@type': 'Offer', price, priceCurrency: 'USD' },
  });

const pageFor = (url: string): string => {
  if (url.includes('/product/mug')) return `<html><head><script type="application/ld+json">${productLd('Handmade Mug', '24.00', 'https://cdn.example/mug.jpg')}</script></head><body>Mug</body></html>`;
  if (url.includes('/product/bowl')) return `<html><head><script type="application/ld+json">${productLd('Bowl', '18.50', 'https://cdn.example/bowl.jpg')}</script></head><body>Bowl</body></html>`;
  if (url.includes('/collections/kitchen'))
    return `<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', item: { '@type': 'Product', name: 'Handmade Mug', offers: { price: '24.00', priceCurrency: 'USD' } } },
        { '@type': 'ListItem', item: { '@type': 'Product', name: 'Plate', offers: { price: '12.00', priceCurrency: 'USD' } } },
      ],
    })}</script></head><body>Kitchen</body></html>`;
  return '<html><body>nothing</body></html>';
};

const fetched: string[] = [];
const fakeFetch = async (url: string) => {
  fetched.push(url);
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: () => 'text/html' },
    body: null,
    text: async () => pageFor(url),
  } as any;
};

beforeEach(() => {
  fetched.length = 0;
});

describe('pickProductPageCandidates', () => {
  it('takes same-origin product pages first, then collections; skips the rest', () => {
    const c = pickProductPageCandidates(scraped, 8);
    expect(c).toEqual([
      'https://shop.example/product/mug',
      'https://shop.example/product/bowl/',
      'https://shop.example/collections/kitchen',
    ]);
  });

  it('respects the page cap', () => {
    expect(pickProductPageCandidates(scraped, 1)).toEqual(['https://shop.example/product/mug']);
  });
});

describe('scrapeProductPages', () => {
  it('reads Product JSON-LD from each subpage and de-duplicates by handle', async () => {
    const products = await scrapeProductPages(scraped, fakeFetch as any, 8);
    // Mug (product page) + Bowl (product page) + Plate (collection ItemList); the collection's
    // second copy of the Mug is dropped by handle.
    expect(products.map((p) => p.title).sort()).toEqual(['Bowl', 'Handmade Mug', 'Plate']);
    const mug = products.find((p) => p.title === 'Handmade Mug')!;
    expect(mug.priceCents).toBe(2400);
    expect(mug.images).toEqual(['https://cdn.example/mug.jpg']);
  });

  it('never fetches cross-origin or non-product links', async () => {
    await scrapeProductPages(scraped, fakeFetch as any, 8);
    expect(fetched.some((u) => u.includes('other.example'))).toBe(false);
    expect(fetched.some((u) => u.endsWith('/about'))).toBe(false);
    expect(fetched.some((u) => u.endsWith('/cart'))).toBe(false);
  });

  it('skips a subpage that fails or is not HTML, and still returns the others', async () => {
    const flaky = async (url: string) => {
      if (url.includes('/product/bowl')) throw new Error('boom');
      if (url.includes('/collections/')) {
        return { ok: true, status: 200, url, headers: { get: () => 'application/json' }, body: null, text: async () => '{}' } as any;
      }
      return fakeFetch(url);
    };
    const products = await scrapeProductPages(scraped, flaky as any, 8);
    expect(products.map((p) => p.title)).toEqual(['Handmade Mug']);
  });

  it('returns [] when the page has no product-like links at all', async () => {
    const products = await scrapeProductPages(
      { ...scraped, links: [{ label: 'About', href: 'https://shop.example/about' }] },
      fakeFetch as any,
      8,
    );
    expect(products).toEqual([]);
    expect(fetched).toEqual([]);
  });
});
