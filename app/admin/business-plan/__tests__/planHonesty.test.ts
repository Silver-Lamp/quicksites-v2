/**
 * The business plan is shown to partners and investors, who cannot check its numbers.
 * These guards are about that asymmetry, not about style.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { VERTICALS, STAGE_LABEL } from '@/lib/business/verticals';

const PAGE = readFileSync(join(process.cwd(), 'app/admin/business-plan/page.tsx'), 'utf8');
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
});
