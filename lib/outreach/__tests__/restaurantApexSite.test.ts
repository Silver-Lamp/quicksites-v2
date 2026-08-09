// lib/outreach/__tests__/restaurantApexSite.test.ts
//
// The restaurant-apex template type: the seed is a hero-only portal stamped
// site_type='restaurant_apex' (never claimable), the type detector reads both
// normalizer shapes, and the hero copy stays brand-free (delivered.menu attribution
// renders as the directory's unlinked footer — the SEO-safe pattern across many
// <city>-restaurant.com domains).

import { randomUUID } from 'crypto';
import { apexTemplateSeed, isRestaurantApexData, RESTAURANT_APEX_SITE_TYPE } from '../restaurantApexSite';

// The starter builder (createEmptyTemplate) calls crypto.randomUUID(), absent from
// this Jest environment's global crypto — polyfill from node:crypto.
beforeAll(() => {
  const g = globalThis as any;
  if (!g.crypto) g.crypto = {};
  if (!g.crypto.randomUUID) g.crypto.randomUUID = randomUUID;
});

const input = {
  city: 'Renton',
  region: 'WA',
  domain: 'renton-restaurant.com',
  slug: 'renton-restaurant',
  campaignId: 'camp1',
};

describe('apexTemplateSeed', () => {
  it('builds a hero-only portal typed restaurant_apex, unclaimable, slug = apex label', () => {
    const row = apexTemplateSeed(input);
    expect(row.slug).toBe('renton-restaurant');
    expect(row.template_name).toBe('Renton Restaurants');
    expect(row.industry).toBe('restaurant');
    expect(row.claim_source).toBeUndefined(); // apex is platform-owned, never claimable

    const meta = row.data?.meta ?? {};
    expect(meta.site_type).toBe(RESTAURANT_APEX_SITE_TYPE);
    expect(meta.apex_campaign_id).toBe('camp1');
    expect(meta.apex_domain).toBe('renton-restaurant.com');

    // Portal, not a business site: hero + dish search + the live directory — no menu/hours/contact.
    const blocks = row.data?.pages?.[0]?.blocks ?? [];
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('hero');
    expect(blocks[0].content.headline).toBe('Order from local restaurants in Renton, WA');

    // ⚠️ The CTA must point at an id the page ACTUALLY renders. `site-renderer` gives the first
    // block of each type `id=<type>`, and the seed shipped with text but no link — so it
    // inherited the restaurant starter's and scrolled to a contact form this portal lacks.
    expect(blocks[0].content.cta_text).toBe('Browse restaurants');
    expect(blocks[0].content.cta_link).toBe('#restaurants_directory');
    expect(blocks.some((b: any) => b.type === blocks[0].content.cta_link.slice(1))).toBe(true);

    // The dish search is the apex's reason to exist, not a demo-only extra.
    expect(blocks[1].type).toBe('menu_finder');
    expect(blocks[1].content.campaign_id).toBe('camp1');

    expect(blocks[2].type).toBe('restaurants_directory');
    expect(blocks[2].content.campaign_id).toBe('camp1'); // drives the live cohort fetch
    expect(blocks[2].content.title).toBe('Restaurants in Renton, WA');

    // Portal chrome trimmed: header/footer nav collapses to Home.
    for (const chrome of [row.header_block, row.footer_block]) {
      if (chrome?.content && Array.isArray(chrome.content.links)) {
        expect(chrome.content.links).toEqual([{ label: 'Home', href: '/', appearance: 'default' }]);
      }
    }
  });

  it('keeps the hero copy brand-free even when a menu brand is passed (footer carries it)', () => {
    const row = apexTemplateSeed({ ...input, menuBrand: 'delivered.menu' });
    const hero = row.data.pages[0].blocks[0];
    expect(hero.content.subheadline).not.toContain('delivered.menu'); // no cross-domain boilerplate
    expect(row.data.meta.menu_brand).toBe('delivered.menu'); // recorded for the render layer
  });
});

describe('isRestaurantApexData', () => {
  it('detects the type on data or nested data.meta shapes; false otherwise', () => {
    const row = apexTemplateSeed(input);
    expect(isRestaurantApexData(row.data)).toBe(true);
    expect(isRestaurantApexData({ data: row.data })).toBe(true);
    expect(isRestaurantApexData({ meta: { site_type: 'other' } })).toBe(false);
    expect(isRestaurantApexData(null)).toBe(false);
  });
});
