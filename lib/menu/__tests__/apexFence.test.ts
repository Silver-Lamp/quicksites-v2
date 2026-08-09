/**
 * The delivered.menu apex namespace.
 *
 * ⚠️ These assert the SHAPE of the rule, not a snapshot of today's route list. The valuable
 * property is that an unknown segment is a restaurant, not a QuickSites page — so a marketing
 * route added later and forgotten here is absent from the deliverable domain rather than leaked
 * onto it.
 */

const ORIGINAL = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN;

beforeAll(() => {
  process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN = 'delivered.menu';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN = ORIGINAL;
});

// Imported after the env is set — MENU_BASE_DOMAIN is read at module load.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apexRedirectTarget, menuPathSlug } = require('../deliveredMenu');

describe('apexRedirectTarget', () => {
  // These were all live on delivered.menu: an agency pitching resellers on the restaurant's
  // own address.
  it.each(['/partners', '/compare', '/restaurants', '/build', '/pricing'])(
    'sends %s to quicksites.ai',
    (p) => {
      expect(apexRedirectTarget(p)).toBe(`https://www.quicksites.ai${p}`);
    },
  );

  it('preserves the rest of the path', () => {
    expect(apexRedirectTarget('/compare/duda')).toBe('https://www.quicksites.ai/compare/duda');
  });

  it('leaves a restaurant slug alone', () => {
    expect(apexRedirectTarget('/joes-pizza')).toBeNull();
    expect(apexRedirectTarget('/')).toBeNull();
  });

  // ⚠️ A restaurant genuinely called "Compare" would be shadowed. That is the accepted cost of a
  // shared namespace, and it fails visibly (the owner sees the wrong page immediately) rather
  // than silently.
  it('does not redirect a deeper path that merely starts with a reserved word', () => {
    expect(apexRedirectTarget('/partners-pizza')).toBeNull();
  });
});

describe('menuPathSlug', () => {
  it('treats an unknown segment as a restaurant — the safe direction', () => {
    expect(menuPathSlug('/some-new-marketing-page')).toBe('some-new-marketing-page');
    expect(menuPathSlug('/joes-pizza/menu')).toBe('joes-pizza');
  });

  it('never treats infrastructure or ordering paths as a restaurant', () => {
    for (const p of ['/api/x', '/_next/y', '/cart', '/checkout', '/login', '/claim-site/abc']) {
      expect(menuPathSlug(p)).toBeNull();
    }
  });

  it('no longer claims QuickSites marketing paths — they are redirected instead', () => {
    // menuPathSlug returning a slug here is correct: the redirect fires first in middleware.
    expect(menuPathSlug('/partners')).toBe('partners');
    expect(apexRedirectTarget('/partners')).not.toBeNull();
  });
});
