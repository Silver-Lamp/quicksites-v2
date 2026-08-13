/**
 * @jest-environment node
 */
// The apex portal must be a PORTAL, in both block arrays.
//
// ⚠️ THIS SHIPPED TO A PAID DOMAIN. `seedRestaurantApexSite` replaced `page0.blocks` with
// [hero, menu_finder, restaurants_directory] — correct — but `buildIndustryStarter` also emits
// `page0.content_blocks` carrying the FULL restaurant scaffold, and the renderer prefers
// `content_blocks`. So kent-restaurant.com went live, hours after being bought, serving the
// scaffold's invented menu — "Two Eggs Any Style", "Buttermilk Pancakes", "House Burger",
// "Signature Entrée" — under the heading "Kent Restaurants".
//
// Renton's apex was fine, which is what made it invisible: its two arrays happened to be in sync, so
// the same code produced a correct page there and a wrong one in Kent. A bug that reproduces on one
// city and not another reads as a data problem, not a code one.
//
// This is the two-array trap documented at the top of lib/menu/menuBlocks.ts, and it has now cost
// twice — a menu backfill once read the wrong array and reported real menus as empty. Anything that
// REPLACES a page's blocks must write both, or it has only rewritten the copy nobody renders.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'lib/outreach/restaurantApexSite.ts'), 'utf8');

describe('seedRestaurantApexSite writes both block arrays', () => {
  it('assigns page0.blocks and page0.content_blocks from one portal array', () => {
    expect(SRC).toMatch(/page0\.blocks\s*=\s*portal/);
    expect(SRC).toMatch(/page0\.content_blocks\s*=\s*portal/);
  });

  // ⚠️ Guards the specific regression: setting only `blocks` is what shipped.
  it('never assigns blocks without also assigning content_blocks', () => {
    const assignsBlocks = [...SRC.matchAll(/page0\.blocks\s*=/g)].length;
    const assignsContent = [...SRC.matchAll(/page0\.content_blocks\s*=/g)].length;
    expect(assignsContent).toBeGreaterThanOrEqual(assignsBlocks);
  });

  it('builds the portal from hero + finder + directory, not the restaurant scaffold', () => {
    expect(SRC).toMatch(/const portal = \[hero, finder, directory\]/);
  });
});

describe('the portal keeps a diner in mind', () => {
  // Regressions previously fixed here and worth keeping fixed — a claim pitch in the hero was
  // removed after a persona walkthrough ("I don't want to claim anything, I want to eat").
  it('has no claim pitch in the hero copy', () => {
    const hero = SRC.slice(SRC.indexOf('hero.content.subheadline'), SRC.indexOf('cta_text'));
    expect(hero.toLowerCase()).not.toContain('claim');
  });

  it('points the CTA at an id the page actually has', () => {
    expect(SRC).toMatch(/cta_link = '#restaurants_directory'/);
  });
});
