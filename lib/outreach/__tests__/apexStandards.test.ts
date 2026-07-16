// lib/outreach/__tests__/apexStandards.test.ts
//
// Apex standards transform: re-asserts the portal invariants (winner-first directory
// block, Home-only chrome, SEO defaults, type + version stamps) — idempotent, and
// NEVER touches the individual bits (hero copy, theme, custom nav, custom SEO copy).

import { randomUUID } from 'crypto';
import { applyApexStandards, APEX_STANDARDS_VERSION } from '../apexStandards';
import { RESTAURANT_APEX_SITE_TYPE } from '../restaurantApexSite';

// createDefaultBlock calls crypto.randomUUID(), absent from this Jest environment's
// global crypto — polyfill from node:crypto.
beforeAll(() => {
  const g = globalThis as any;
  if (!g.crypto) g.crypto = {};
  if (!g.crypto.randomUUID) g.crypto.randomUUID = randomUUID;
});

const block = (type: string, content: any = {}) => ({ _id: `${type}-1`, type, content });

/** A legacy hero-only apex: stale business chrome, no directory, no meta stamps. */
function bareApex() {
  return {
    data: {
      pages: [
        {
          slug: 'index',
          blocks: [block('hero', { headline: 'Order from local restaurants in Renton' })],
        },
      ],
      meta: {},
    },
    headerBlock: {
      type: 'header',
      content: {
        nav_items: [
          { label: 'Home', href: '/', appearance: 'default' },
          { label: 'Services', href: '/services', appearance: 'default' },
          { label: 'Contact', href: '/contact', appearance: 'default' },
        ],
      },
    },
    footerBlock: {
      type: 'footer',
      content: { links: [{ label: 'Contact', href: '/contact', appearance: 'default' }] },
    },
    campaignId: 'camp1',
    city: 'Renton',
    region: 'WA',
  };
}

describe('applyApexStandards', () => {
  it('upgrades a bare apex: directory after hero, portal chrome, stamps, SEO defaults', () => {
    const r = applyApexStandards(bareApex());
    expect(r.changed).toBe(true);
    expect(r.applied.sort()).toEqual(
      ['directory_block', 'footer_portal_nav', 'header_portal_nav', 'seo_meta', 'site_type_stamp', 'standards_version'].sort(),
    );

    // The winner-first directory block sits right after the hero, wired to the campaign.
    const blocks = r.data.pages[0].blocks;
    expect(blocks.map((b: any) => b.type)).toEqual(['hero', 'restaurants_directory']);
    expect(blocks[1].content.campaign_id).toBe('camp1');
    expect(blocks[1].content.title).toBe('Restaurants in Renton, WA');

    // Home-only portal chrome.
    expect(r.headerBlock.content.nav_items).toEqual([{ label: 'Home', href: '/', appearance: 'default' }]);
    expect(r.footerBlock.content.links).toEqual([{ label: 'Home', href: '/', appearance: 'default' }]);

    // Stamps + SEO defaults.
    const meta = r.data.meta;
    expect(meta.site_type).toBe(RESTAURANT_APEX_SITE_TYPE);
    expect(meta.apex_campaign_id).toBe('camp1');
    expect(meta.title).toBe('Order from restaurants in Renton, WA');
    expect(meta.description).toBe('Browse and order online from local restaurants in Renton, WA.');
    expect(meta.apex_standards_version).toBe(APEX_STANDARDS_VERSION);

    // The individual bits are untouched.
    expect(blocks[0].content.headline).toBe('Order from local restaurants in Renton');
  });

  it('is idempotent: running the refreshed output again is a no-op', () => {
    const input = bareApex();
    const first = applyApexStandards(input);
    const second = applyApexStandards({
      data: first.data,
      headerBlock: first.headerBlock,
      footerBlock: first.footerBlock,
      campaignId: input.campaignId,
      city: input.city,
      region: input.region,
    });
    expect(second.changed).toBe(false);
    expect(second.applied).toEqual([]);
  });

  it('respects edits: custom nav, custom SEO copy, and a correct directory are untouched', () => {
    const d = bareApex();
    // Operator customized everything the standards would otherwise default.
    d.headerBlock.content.nav_items = [{ label: 'Specials', href: '/specials', appearance: 'default' }];
    d.footerBlock.content.links = [{ label: 'Instagram', href: 'https://instagram.com/x', appearance: 'default' }];
    (d.data.meta as any) = {
      site_type: RESTAURANT_APEX_SITE_TYPE,
      apex_campaign_id: 'camp1',
      title: 'Renton eats, ranked by locals',
      description: 'Hand-picked kitchens.',
      apex_standards_version: APEX_STANDARDS_VERSION,
    };
    d.data.pages[0].blocks.push(
      block('restaurants_directory', { title: 'The contenders', campaign_id: 'camp1', entries: [] }),
    );

    const r = applyApexStandards(d);
    expect(r.changed).toBe(false);
    expect(r.applied).toEqual([]);
    expect(r.headerBlock.content.nav_items[0].href).toBe('/specials');
    expect(r.data.meta.title).toBe('Renton eats, ranked by locals');
    expect(r.data.pages[0].blocks.filter((b: any) => b.type === 'restaurants_directory')).toHaveLength(1);
  });

  it('repoints a directory carrying the wrong campaign_id', () => {
    const d = bareApex();
    (d.data.meta as any) = {
      site_type: RESTAURANT_APEX_SITE_TYPE,
      apex_campaign_id: 'camp1',
      title: 't'.repeat(20),
      description: 'custom',
      apex_standards_version: APEX_STANDARDS_VERSION,
    };
    d.headerBlock.content.nav_items = [{ label: 'Home', href: '/', appearance: 'default' }];
    d.footerBlock.content.links = [{ label: 'Home', href: '/', appearance: 'default' }];
    d.data.pages[0].blocks.push(block('restaurants_directory', { campaign_id: 'old-camp', entries: [] }));

    const r = applyApexStandards(d);
    expect(r.applied).toEqual(['directory_campaign_id']);
    expect(r.data.pages[0].blocks[1].content.campaign_id).toBe('camp1');
  });

  it('version bump alone marks the apex behind: applied = [standards_version]', () => {
    const input = bareApex();
    const current = applyApexStandards(input); // fully up to date…
    current.data.meta.apex_standards_version = APEX_STANDARDS_VERSION - 1; // …then the const bumps

    const r = applyApexStandards({
      data: current.data,
      headerBlock: current.headerBlock,
      footerBlock: current.footerBlock,
      campaignId: input.campaignId,
      city: input.city,
      region: input.region,
    });
    expect(r.applied).toEqual(['standards_version']);
    expect(r.data.meta.apex_standards_version).toBe(APEX_STANDARDS_VERSION);
  });
});
