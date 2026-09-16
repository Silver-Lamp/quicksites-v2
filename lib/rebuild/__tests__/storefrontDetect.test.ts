/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/storefrontDetect.test.ts
//
// "Is this a store?" must be answered from the STATIC page, independent of whether the catalog
// could be read. The fixture shapes are real: FOYTEA (Shoptop, client-rendered, no product links in
// the static HTML — only the platform signature) and hicustom.com (a supplier site that SAYS
// "Shopify" in a form label and is not a store).

import { detectStorefront, storefrontPlatformLabel } from '@/lib/rebuild/storefrontDetect';
import { parseHtml } from '@/lib/rebuild/scrapeSite';

const link = (href: string) => ({ href });

describe('detectStorefront — platform signatures', () => {
  it('detects Shoptop from its script/CDN signature alone (FOYTEA: no static product links)', () => {
    const html = `<html><head><script>window.SHOPTOP={ saSdkUrl:"//static.shoptop.com", theme:{"name":"amplify"}}</script></head>
      <body><a href="/collections/javascript:;">Shop</a><a href="/products/{{product.handle}}">x</a></body></html>`;
    const d = detectStorefront({ html, links: [] });
    expect(d.detected).toBe(true);
    expect(d.platform).toBe('shoptop');
    expect(d.signals).toContain('platform:shoptop');
  });

  it('detects Shopify from cdn.shopify.com', () => {
    const html = `<link href="https://cdn.shopify.com/s/files/1/0001/theme.css" rel="stylesheet">`;
    expect(detectStorefront({ html, links: [] })).toMatchObject({ detected: true, platform: 'shopify' });
  });

  it('does NOT take the word "Shopify" in a form label as a platform signature', () => {
    const html = `<label><input type="checkbox" value="Shopify" name="cross_border_platform"><p>Shopify</p></label>
      <a href="/about">About</a><a href="/contact">Contact</a>`;
    const d = detectStorefront({ html, links: [link('https://supplier.example/about')] });
    expect(d.detected).toBe(false);
    expect(d.platform).toBeNull();
  });
});

describe('detectStorefront — heuristics without a platform', () => {
  it('a brochure site with a single /shop link is not a store', () => {
    const d = detectStorefront({
      html: '<body><nav><a href="/shop">Shop</a><a href="/about">About</a></nav></body>',
      links: [link('https://x.example/shop'), link('https://x.example/about')],
    });
    expect(d.detected).toBe(false);
  });

  it('several product links plus a cart link is a store (custom cart, no signature)', () => {
    const d = detectStorefront({
      html: '<body>Add to cart</body>',
      links: [
        link('https://x.example/product/mug'),
        link('https://x.example/product/bowl'),
        link('https://x.example/cart'),
      ],
    });
    expect(d.detected).toBe(true);
    expect(d.platform).toBeNull();
    expect(d.signals).toEqual(expect.arrayContaining(['product_links:2', 'cart_link', 'add_to_cart_text']));
  });

  it('a goods catalog path plus bare cart text is a store (hicustom.com: /productType/allGoods + 购物车)', () => {
    const d = detectStorefront({
      html: '<nav><a href="/productType/allGoods">商品</a></nav><span>购物车</span>',
      links: [link('https://www.hicustom.com/productType/allGoods'), link('https://www.hicustom.com/frontend/index/aboutUs')],
    });
    expect(d.detected).toBe(true);
    expect(d.platform).toBeNull();
    expect(d.signals).toEqual(expect.arrayContaining(['collection_links:1', 'cart_text']));
  });

  it('a goods catalog path WITHOUT any cart evidence is not enough on its own', () => {
    const d = detectStorefront({
      html: '<nav><a href="/catalog">Catalog</a></nav>',
      links: [link('https://x.example/catalog')],
    });
    expect(d.detected).toBe(false);
  });

  it('Chinese add-to-cart text counts as the cart signal', () => {
    const d = detectStorefront({
      html: '<button>加入购物车</button>',
      links: [link('https://x.example/products/a'), link('https://x.example/products/b')],
    });
    expect(d.detected).toBe(true);
  });

  it('Product JSON-LD on the page is conclusive', () => {
    const d = detectStorefront({
      html: '',
      links: [],
      structuredData: [{ '@type': 'Product', name: 'Mug', offers: { price: '1' } }],
    });
    expect(d.detected).toBe(true);
    expect(d.signals).toContain('product_jsonld');
  });

  it('an @type ARRAY containing Product is conclusive too', () => {
    const d = detectStorefront({
      html: '',
      links: [],
      structuredData: [{ '@graph': [{ '@type': ['Product', 'Thing'], name: 'Mug' }] }],
    });
    expect(d.detected).toBe(true);
  });

  it('the word Product inside a description is not structured data', () => {
    const d = detectStorefront({
      html: '',
      links: [],
      structuredData: [{ '@type': 'Organization', description: 'We make a "Product" for you' }],
    });
    expect(d.detected).toBe(false);
  });
});

describe('parseHtml wires storefront detection into ScrapedSite', () => {
  it('a Shoptop page parses with storefront.platform = shoptop', () => {
    const html = `<html><head><title>FOYTEA</title>
      <script src="//assets.shoptop.com/checkout/preload.js"></script></head><body><h1>Fortune Of Your Brand</h1></body></html>`;
    const s = parseHtml(html, 'https://foytea.com/', 'https://foytea.com/');
    expect(s.storefront.detected).toBe(true);
    expect(s.storefront.platform).toBe('shoptop');
  });

  it('a plain brochure parses with storefront.detected = false', () => {
    const s = parseHtml('<html><body><h1>Hi</h1><a href="/about">About</a></body></html>', 'https://a.example/', 'https://a.example/');
    expect(s.storefront.detected).toBe(false);
  });
});

describe('storefrontPlatformLabel', () => {
  it('labels known ids and passes unknown ones through', () => {
    expect(storefrontPlatformLabel('shoptop')).toBe('Shoptop');
    expect(storefrontPlatformLabel('mystery')).toBe('mystery');
    expect(storefrontPlatformLabel(null)).toBeNull();
  });
});
