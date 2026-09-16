/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/renderedCatalog.test.ts
//
// The browser-rendered rung reads product CARDS off a JS-drawn storefront. The mapping from a
// card to a ProductSpec is pure and pinned here with the exact shapes seen on hicustom.com
// (2026-09-16): "￥21.01起" from-prices, a literal src="undefined/" image, links to a sibling
// host (jit.hicustom.com). The render itself is exercised through an injected renderer.

import {
  parsePriceText,
  cardsToProducts,
  pickListingCandidates,
  importRenderedCatalog,
  renderedCatalogEnabled,
  CATALOG_EXTRACT_JS,
  type RenderedCard,
} from '@/lib/rebuild/renderedCatalog';

describe('parsePriceText', () => {
  it('reads a Chinese from-price as CNY minor units with from=true', () => {
    expect(parsePriceText('￥21.01起')).toEqual({ cents: 2101, currency: 'CNY', from: true });
    expect(parsePriceText('¥28.01')).toEqual({ cents: 2801, currency: 'CNY', from: false });
  });
  it('reads ¥ as JPY (zero-decimal) when the page is Japanese', () => {
    expect(parsePriceText('¥1,980', 'ja')).toEqual({ cents: 1980, currency: 'JPY', from: false });
  });
  it('reads dollars, euros, pounds and prefixed dollars', () => {
    expect(parsePriceText('$4')).toEqual({ cents: 400, currency: 'USD', from: false });
    expect(parsePriceText('US$ 29.99')).toEqual({ cents: 2999, currency: 'USD', from: false });
    expect(parsePriceText('HK$120')).toEqual({ cents: 12000, currency: 'HKD', from: false });
    expect(parsePriceText('€1.299,00')).toEqual({ cents: 129900, currency: 'EUR', from: false });
    expect(parsePriceText('£12.50')).toEqual({ cents: 1250, currency: 'GBP', from: false });
  });
  it('reads a trailing currency word', () => {
    expect(parsePriceText('99 元')).toEqual({ cents: 9900, currency: 'CNY', from: false });
    expect(parsePriceText('from 15 USD')).toEqual({ cents: 1500, currency: 'USD', from: true });
  });
  it('refuses an amount with no currency and empty input', () => {
    expect(parsePriceText('21.01')).toBeNull();
    expect(parsePriceText('')).toBeNull();
  });
});

const hicustomCards: RenderedCard[] = [
  { href: 'https://jit.hicustom.com/spu?id=539882101944618880', title: '180克男士纯棉圆领短袖T恤（美西加州3号仓）', priceText: '￥21.01起', image: 'https://www.hicustom.com/undefined/' },
  { href: 'https://jit.hicustom.com/spu?id=539882103119024000', title: '180克男士纯棉圆领短袖T恤-背面（美西加州3号仓）', priceText: '￥21.01起', image: null },
  { href: 'https://jit.hicustom.com/spu?id=539882101944618880', title: 'duplicate of the first', priceText: '￥21.01起', image: null },
  { href: 'https://jit.hicustom.com/spu?id=546829635145437056', title: '三明治棒球帽-5片帽（美西加州3号仓）', priceText: '￥24.51起', image: 'https://nimg5.hicustom.com/static/gallery/cap.jpg' },
  { href: 'https://www.hicustom.com/spu?id=1', title: 'No price card', priceText: '', image: null },
];

describe('cardsToProducts', () => {
  const products = cardsToProducts(hicustomCards, 'zh-cn');

  it('maps titles, from-prices and currency verbatim; drops priceless and duplicate cards', () => {
    expect(products.map((p) => p.title)).toEqual([
      '180克男士纯棉圆领短袖T恤（美西加州3号仓）',
      '180克男士纯棉圆领短袖T恤-背面（美西加州3号仓）',
      '三明治棒球帽-5片帽（美西加州3号仓）',
    ]);
    expect(products[0]).toMatchObject({ priceCents: 2101, currency: 'CNY', priceFrom: true, productUrl: hicustomCards[0].href });
  });

  it('imports a product with NO image when the store shows a broken one — never a guessed image', () => {
    expect(products[0].images).toEqual([]);
    expect(products[2].images).toEqual(['https://nimg5.hicustom.com/static/gallery/cap.jpg']);
  });

  it('derives a stable handle from the product URL id', () => {
    expect(products[0].handle).toBe('spu-539882101944618880');
    expect(new Set(products.map((p) => p.handle)).size).toBe(products.length);
  });
});

describe('pickListingCandidates', () => {
  it('picks same-origin listing links, skips javascript: pseudo-links, caps at two', () => {
    const scraped: any = {
      sourceUrl: 'https://foytea.com/',
      finalUrl: 'https://foytea.com/',
      links: [
        { label: 'x', href: 'https://foytea.com/collections/javascript:;' },
        { label: 'FOY select', href: 'https://foytea.com/pages/foy-select' },
        { label: 'About', href: 'https://foytea.com/pages/about-foytea' },
        { label: 'All', href: 'https://www.hicustom.com/productType/allGoods' },
        { label: 'Shop', href: 'https://foytea.com/collections/all' },
        { label: 'Store', href: 'https://foytea.com/store' },
      ],
    };
    expect(pickListingCandidates(scraped)).toEqual(['https://foytea.com/pages/foy-select', 'https://foytea.com/collections/all']);
  });
});

describe('importRenderedCatalog', () => {
  const scraped: any = {
    sourceUrl: 'https://www.hicustom.com/',
    finalUrl: 'https://www.hicustom.com/',
    links: [{ label: 'All goods', href: 'https://www.hicustom.com/productType/allGoods' }],
  };

  it('returns the homepage cards without rendering a second page', async () => {
    const calls: string[] = [];
    const renderer = (async (url: string) => {
      calls.push(url);
      return { ok: true, driver: 'playwright', value: { lang: 'zh-cn', anchors: 25, cards: hicustomCards } };
    }) as any;
    const r = await importRenderedCatalog(scraped, { renderer });
    expect(r.products).toHaveLength(3);
    expect(r.driver).toBe('playwright');
    expect(calls).toEqual(['https://www.hicustom.com/']);
  });

  it('falls through to a listing page when the homepage shows no cards', async () => {
    const calls: string[] = [];
    const renderer = (async (url: string) => {
      calls.push(url);
      const cards = url.includes('allGoods') ? hicustomCards : [];
      return { ok: true, driver: 'playwright', value: { lang: '', anchors: 0, cards } };
    }) as any;
    const r = await importRenderedCatalog(scraped, { renderer });
    expect(calls).toEqual(['https://www.hicustom.com/', 'https://www.hicustom.com/productType/allGoods']);
    expect(r.products).toHaveLength(3);
  });

  it('reports a render failure as an error, never as an empty catalog', async () => {
    const renderer = (async () => ({ ok: false, driver: 'serverless', error: 'Could not find Chrome (executablePath)' })) as any;
    const r = await importRenderedCatalog(scraped, { renderer });
    expect(r.products).toEqual([]);
    expect(r.error).toMatch(/executablePath/);
    expect(r.driver).toBe('serverless');
  });

  it('is on by default and off only on an explicit 0/false', () => {
    const prev = process.env.REBUILD_BROWSER_CATALOG_ENABLED;
    delete process.env.REBUILD_BROWSER_CATALOG_ENABLED;
    expect(renderedCatalogEnabled()).toBe(true);
    process.env.REBUILD_BROWSER_CATALOG_ENABLED = '0';
    expect(renderedCatalogEnabled()).toBe(false);
    process.env.REBUILD_BROWSER_CATALOG_ENABLED = 'false';
    expect(renderedCatalogEnabled()).toBe(false);
    if (prev === undefined) delete process.env.REBUILD_BROWSER_CATALOG_ENABLED;
    else process.env.REBUILD_BROWSER_CATALOG_ENABLED = prev;
  });
});

describe('CATALOG_EXTRACT_JS', () => {
  it('is plain evaluable JS with no template literals (it runs raw in two Chromium builds)', () => {
    expect(CATALOG_EXTRACT_JS).not.toMatch(/`|\$\{/);
    // eslint-disable-next-line no-new-func
    expect(() => new Function(`return ${CATALOG_EXTRACT_JS.replace(/\)\(\)$/, ')')}`)).not.toThrow();
  });
});
