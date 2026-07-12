/**
 * @jest-environment node
 */
// lib/outreach/__tests__/readiness.test.ts

import { analyzeReadiness, readinessChecklist } from '@/lib/outreach/readiness';

// A "fully refined" non-food site: NAP + click-to-call + hero + services + logo + schema
// + a subpage + a good title → no hard blockers, no soft blockers.
function refinedNonFood() {
  return {
    meta: {
      title: 'Boston Plumbing — 24/7 Emergency Plumber',
      logo_url: 'https://cdn/logo.png',
      schema: { localBusiness: true },
      contact: { phone: '617-555-0100', address: '1 Main St, Boston MA' },
    },
    pages: [
      {
        blocks: [
          { type: 'hero', content: { headline: 'Boston Plumbing', subheadline: 'Fast, licensed plumbers.' } },
          { type: 'services', content: { items: [{ name: 'Drain cleaning' }, { name: 'Water heaters' }] } },
          { type: 'contact', content: { phone: '617-555-0100', address: '1 Main St' } },
          { type: 'order_bar', content: {} }, // click-to-call
        ],
      },
      { blocks: [{ type: 'hero', content: { headline: 'Drain Cleaning in Boston' } }] }, // subpage
    ],
  };
}

const ids = (r: ReturnType<typeof analyzeReadiness>) => r.blockers.map((b) => b.id);

describe('analyzeReadiness — non-food', () => {
  it('a refined site has no blockers', () => {
    const r = analyzeReadiness(refinedNonFood(), 'plumbing');
    expect(r.blockers).toEqual([]);
    expect(r.hardBlocked).toBe(false);
  });

  it('flags missing NAP + click-to-call + services as hard', () => {
    const r = analyzeReadiness({ pages: [{ blocks: [{ type: 'hero', content: { headline: 'Hi' } }] }] }, 'plumbing');
    expect(ids(r)).toEqual(expect.arrayContaining(['no-nap', 'no-click-to-call', 'no-services']));
    expect(r.hardBlocked).toBe(true);
  });

  it('flags empty hero headline and placeholder hero copy', () => {
    const empty = analyzeReadiness({ pages: [{ blocks: [{ type: 'hero', content: { headline: '' } }] }] }, 'plumbing');
    expect(ids(empty)).toContain('hero-empty');

    const ph = analyzeReadiness(
      { pages: [{ blocks: [{ type: 'hero', content: { headline: 'Your Business Name', subheadline: 'Lorem ipsum' } }] }] },
      'plumbing',
    );
    expect(ids(ph)).toContain('hero-placeholder');
  });

  it('soft blockers do not hard-block', () => {
    // Refined but missing logo + schema + single page → soft only.
    const data = {
      meta: { title: 'Boston Plumbing — Licensed Plumbers', contact: { phone: '617-555-0100' } },
      pages: [
        {
          blocks: [
            { type: 'hero', content: { headline: 'Boston Plumbing' } },
            { type: 'services', content: { items: [{ name: 'Drains' }] } },
            { type: 'order_bar', content: {} },
          ],
        },
      ],
    };
    const r = analyzeReadiness(data, 'plumbing');
    expect(r.hardBlocked).toBe(false);
    expect(ids(r)).toEqual(expect.arrayContaining(['no-logo', 'no-schema', 'single-page']));
  });
});

describe('analyzeReadiness — food', () => {
  const foodBase = {
    meta: { title: "Joe's Diner — Breakfast & Lunch", logo_url: 'x', schema: { localBusiness: true }, contact: { phone: '617-555-0199' } },
    pages: [
      {
        blocks: [
          { type: 'hero', content: { headline: "Joe's Diner" } },
          { type: 'order_bar', content: {} },
        ],
      },
      { blocks: [{ type: 'hero', content: { headline: 'Menu' } }] },
    ],
  };

  it('requires a priced menu', () => {
    const noMenu = analyzeReadiness(foodBase, 'restaurant');
    expect(ids(noMenu)).toContain('no-menu');

    const withMenu = {
      ...foodBase,
      pages: [
        {
          blocks: [
            ...foodBase.pages[0].blocks,
            { type: 'menu', content: { sections: [{ name: 'Breakfast', items: [{ name: 'Eggs', price: '$11' }] }] } },
          ],
        },
        foodBase.pages[1],
      ],
    };
    const okr = analyzeReadiness(withMenu, 'restaurant');
    expect(okr.hardBlocked).toBe(false);
    expect(ids(okr)).not.toContain('no-menu');
    expect(ids(okr)).not.toContain('no-services'); // food sites aren't judged on services
  });

  it('readinessChecklist mirrors the failing checks with ok flags', () => {
    const data = {
      ...foodBase,
      pages: [
        { blocks: [...foodBase.pages[0].blocks, { type: 'menu', content: { sections: [{ items: [{ name: 'Eggs' }] }] } }] },
        foodBase.pages[1],
      ],
    };
    const list = readinessChecklist(data, 'restaurant');
    const menu = list.find((i) => i.id === 'menu')!;
    expect(menu.ok).toBe(false); // unpriced → not ok
    expect(list.find((i) => i.id === 'nap')!.ok).toBe(true); // foodBase has a phone
    // food checklist has a menu item, not a services item
    expect(list.some((i) => i.id === 'services')).toBe(false);
    expect(list.find((i) => i.id === 'nap')!.fixableByOrgAddress).toBe(true);
  });

  it('flags an unpriced menu as hard', () => {
    const data = {
      ...foodBase,
      pages: [
        { blocks: [...foodBase.pages[0].blocks, { type: 'menu', content: { sections: [{ items: [{ name: 'Eggs' }] }] } }] },
        foodBase.pages[1],
      ],
    };
    expect(ids(analyzeReadiness(data, 'restaurant'))).toContain('menu-unpriced');
  });
});
