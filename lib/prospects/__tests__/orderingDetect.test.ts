/**
 * @jest-environment node
 */
// lib/prospects/__tests__/orderingDetect.test.ts
//
// The detector reads LINKS, not prose. The three things that would make the segment wrong:
// a brand name in a sentence counted as a platform, a failed fetch counted as "none", and a
// subpage link missed because only the homepage was read.
import { detectOrderingPlatform, orderingSubpageLinks, readOrderingPlatform } from '@/lib/prospects/orderingDetect';
import { groupRestaurantsByOrdering, platformFromWebsiteHost, looksLikeFoodBusiness } from '@/lib/prospects/orderingSegments';

describe('detectOrderingPlatform — links, never prose', () => {
  it('finds Toast from an order link and returns the host as evidence', () => {
    const d = detectOrderingPlatform('<a class="btn" href="https://order.toasttab.com/online/island-queen">Order online</a>');
    expect(d.platform).toBe('toast');
    expect(d.evidence).toEqual(['order.toasttab.com']);
  });

  it('a brand name in a sentence is not a platform', () => {
    const d = detectOrderingPlatform('<p>We used to be on DoorDash and Toast but now you just call us.</p>');
    expect(d.platform).toBe('none');
    expect(d.evidence).toEqual([]);
  });

  it('third-party only is reported as the third party; first-party wins when both are linked', () => {
    expect(detectOrderingPlatform('<a href="https://www.doordash.com/store/x">Delivery</a>').platform).toBe('doordash');
    const both = detectOrderingPlatform('<a href="https://www.doordash.com/store/x">Delivery</a><a href="https://x.square.site/">Order</a>');
    expect(both.platform).toBe('square');
    expect(both.all).toEqual(['square', 'doordash']);
  });

  it('a self-hosted cart is a SHOP, read from markup — the Roasterie case', () => {
    const d = detectOrderingPlatform('<a class="button product_type_simple add_to_cart_button" href="/shop/?add-to-cart=1234">Add to cart</a><link href="/wp-content/plugins/woocommerce/assets/css/x.css">');
    expect(d.platform).toBe('woocommerce');
    expect(d.evidence[0]).toMatch(/^markup:/);
    // A food-ordering platform beside a shop wins: the shop is not the ordering.
    expect(detectOrderingPlatform('<a href="https://order.toasttab.com/x">Order</a><div class="woocommerce">').platform).toBe('toast');
  });

  it('matches the host, not a substring — nottoasttab.com is not Toast', () => {
    expect(detectOrderingPlatform('<a href="https://nottoasttab.com/x">x</a>').platform).toBe('none');
    expect(detectOrderingPlatform('<img src="//cdn.toast.app/logo.png">').platform).toBe('toast');
  });

  it('finds same-origin order/menu subpages and ignores off-site and self links', () => {
    const html = '<a href="/order-online">Order</a><a href="https://other.com/menu">Menu</a><a href="/">Home</a><a href="/menu.pdf">Our menu</a><a href="/about">About</a>';
    expect(orderingSubpageLinks(html, 'https://www.example.com/')).toEqual(['https://www.example.com/order-online', 'https://www.example.com/menu.pdf']);
  });
});

describe('readOrderingPlatform — a failed read is not a finding', () => {
  const page = (body: string, url: string) =>
    ({ ok: true, url, headers: new Headers({ 'content-type': 'text/html' }), body: null, text: async () => body, arrayBuffer: async () => new TextEncoder().encode(body).buffer } as unknown as Response);

  it('reads the subpage when the homepage links nothing', async () => {
    const fetchImpl = (async (u: string | URL | Request) => {
      const url = String(u);
      if (url.endsWith('/order')) return page('<a href="https://x.square.site/">Order</a>', url);
      return page('<a href="/order">Order online</a>', url);
    }) as unknown as typeof fetch;
    const r = await readOrderingPlatform('https://example.com', fetchImpl);
    expect(r).toEqual({ ok: true, detection: expect.objectContaining({ platform: 'square' }), pagesRead: 2, provider: 'custom' });
  });

  it('an unreachable site is unreachable, never none', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    expect(await readOrderingPlatform('https://example.com', fetchImpl)).toEqual({ ok: false, reason: 'unreachable' });
    expect(await readOrderingPlatform('http://127.0.0.1/', fetchImpl)).toEqual({ ok: false, reason: 'bad_url' });
  });
});

describe('groupRestaurantsByOrdering — unchecked is its own bucket', () => {
  const row = (o: Partial<Parameters<typeof groupRestaurantsByOrdering>[0][number]>) => ({
    id: 'x', business_name: 'x', phone: null, website: 'https://x.com', rating: null, review_count: 0,
    ordering_platform: null, ordering_checked_at: null, template_id: null, ...o,
  });

  it('splits call / siteOnly / thirdParty / leaveAlone / unchecked', () => {
    const g = groupRestaurantsByOrdering([
      row({ id: 'a', ordering_platform: 'none', ordering_checked_at: '2026-10-10' }),
      row({ id: 'b', website: 'https://order.toasttab.com/online/b' }),
      row({ id: 'c', ordering_platform: 'doordash', ordering_checked_at: '2026-10-10' }),
      row({ id: 'd', ordering_platform: 'toast', ordering_checked_at: '2026-10-10' }),
      row({ id: 'e' }),
      row({ id: 'f', website: null }),
      row({ id: 'g', ordering_platform: 'woocommerce', ordering_checked_at: '2026-10-10' }),
    ]);
    expect(g.call.map((r) => r.id)).toEqual(['a']);
    expect(g.shop.map((r) => r.id)).toEqual(['g']);
    expect(g.siteOnly.map((r) => r.id)).toEqual(['b']);
    expect(g.thirdParty.map((r) => r.id)).toEqual(['c']);
    expect(g.leaveAlone.map((r) => r.id)).toEqual(['d']);
    expect(g.unchecked.map((r) => r.id)).toEqual(['e']);
  });

  it("a row stamped `restaurant` by the sweep's query is not a restaurant unless Google's types say so", () => {
    expect(looksLikeFoodBusiness(['veterinary_care', 'point_of_interest'])).toBe(false);
    expect(looksLikeFoodBusiness(['accounting', 'finance'])).toBe(false);
    expect(looksLikeFoodBusiness(['pizza_restaurant', 'restaurant', 'food'])).toBe(true);
    expect(looksLikeFoodBusiness(['brewery', 'bar'])).toBe(true);
    expect(looksLikeFoodBusiness([])).toBe(true);
    expect(looksLikeFoodBusiness(null)).toBe(true);
  });

  it('a Google "website" that is itself an ordering page means no site of their own', () => {
    expect(platformFromWebsiteHost('https://order.toasttab.com/online/x')).toBe('toast');
    expect(platformFromWebsiteHost('https://www.vashoniq.com/')).toBeNull();
  });
});
