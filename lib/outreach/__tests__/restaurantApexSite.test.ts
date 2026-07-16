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

    // Portal, not a business site: ONE hero block — no menu/hours/contact.
    const blocks = row.data?.pages?.[0]?.blocks ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('hero');
    expect(blocks[0].content.headline).toBe('Order from local restaurants in Renton, WA');
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
