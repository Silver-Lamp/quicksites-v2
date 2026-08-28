/**
 * The business plan is shown to partners and investors, who cannot check its numbers.
 * These guards are about that asymmetry, not about style.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { VERTICALS, STAGE_LABEL } from '@/lib/business/verticals';

const PAGE = readFileSync(join(process.cwd(), 'app/admin/business-plan/page.tsx'), 'utf8');
const DECK = readFileSync(
  join(process.cwd(), 'components/admin/business-plan/deck-client.tsx'),
  'utf8'
);
const DECK_PAGE = readFileSync(
  join(process.cwd(), 'app/admin/business-plan/deck/page.tsx'),
  'utf8'
);
const LIB = readFileSync(join(process.cwd(), 'lib/business/verticals.ts'), 'utf8');

describe('business plan', () => {
  it('is admin-gated in the page itself', () => {
    // app/admin/layout.tsx only checks "logged in and not a guest", and this page carries
    // revenue figures and unshipped strategy.
    expect(PAGE).toContain('getAdminUser()');
    expect(PAGE).toMatch(/if \(!admin\) return/);
  });

  it('gives every vertical an unproven list, and never an empty one', () => {
    // A vertical with nothing unproven is a vertical whose author stopped looking. The
    // whole document's credibility rests on this column being real.
    for (const v of VERTICALS) {
      expect(v.unproven.length).toBeGreaterThan(0);
      expect(v.decisiveTest.trim().length).toBeGreaterThan(0);
    }
  });

  it('states a stage for every vertical, from the known set', () => {
    for (const v of VERTICALS) expect(STAGE_LABEL[v.stage]).toBeTruthy();
  });

  it('claims nothing is "proven" that has not actually taken money', () => {
    // Guards the easy drift where a built-but-inert line gets promoted because it demos
    // well. Promotion should follow revenue, which the page reads from the DB.
    const proven = VERTICALS.filter((v) => v.stage === 'proven');
    expect(proven).toHaveLength(0);
  });

  it('reads its figures from the database rather than hardcoding them', () => {
    expect(PAGE).toContain('loadPlanEvidence');
    const hardcodedMoney = /\$[\d,]+(\.\d{2})?(?![\d)])/g;
    expect(PAGE.match(hardcodedMoney) || []).toEqual([]);
  });

  it('keeps price points with the vertical they describe', () => {
    // $99/$399 are product facts; changing a price should be one edit, not a search.
    expect(LIB).toContain('$99');
    expect(LIB).toContain('$399');
  });

  it('builds the deck from the same verticals, not a second copy', () => {
    // A deck maintained separately drifts from the plan, and then the room is told one thing
    // while the database says another.
    expect(DECK_PAGE).toContain('VERTICALS');
    expect(DECK_PAGE).toContain('loadPlanEvidence');
    expect(DECK).toContain("from '@/lib/business/verticals'");
  });

  it('gates the deck route too — it is a separate page, not a mode of a gated one', () => {
    expect(DECK_PAGE).toContain('getAdminUser()');
    expect(DECK_PAGE).toMatch(/if \(!admin\) return/);
  });

  it('hardcodes no dollar figure in the deck either', () => {
    const hardcodedMoney = /\$[\d,]+(\.\d{2})?(?![\d)])/g;
    expect(DECK.match(hardcodedMoney) || []).toEqual([]);
  });

  it('renders every vertical as a slide rather than a curated subset', () => {
    // Dropping the weak ones for a pitch is the exact edit this guard exists to catch.
    expect(DECK).toContain('verticals.map');
  });
});
