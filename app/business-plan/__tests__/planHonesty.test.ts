/**
 * The business plan is sent to partners and investors, who cannot check its numbers.
 * These guards are about that asymmetry, not about style.
 *
 * It became SHAREABLE on 2026-08-28 (it was admin-gated, which made it unsendable and so
 * unused). The gate did not vanish — it shrank to one operator panel — and these tests exist
 * to keep that shrinkage honest: the reader must be able to see everything that makes the
 * business look worse, or a public plan is just a pitch with the caveats behind a login.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { VERTICALS, STAGE_LABEL } from '@/lib/business/verticals';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * Source with comment lines dropped. The rules below are about what a reader SEES, and a
 * header comment explaining the rule ("nothing unflattering lives here") would otherwise
 * fail the very check it documents.
 */
const rendered = (src: string) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');

const PAGE = read('app/business-plan/page.tsx');
const BODY = read('components/business-plan/plan-body.tsx');
const OPERATOR = read('components/business-plan/operator-panel.tsx');
const DECK = read('components/business-plan/deck-client.tsx');
const DECK_PAGE = read('app/business-plan/deck/page.tsx');
const LIB = read('lib/business/verticals.ts');

describe('business plan', () => {
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
    expect(BODY.match(hardcodedMoney) || []).toEqual([]);
    expect(OPERATOR.match(hardcodedMoney) || []).toEqual([]);
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

  it('hardcodes no dollar figure in the deck either', () => {
    const hardcodedMoney = /\$[\d,]+(\.\d{2})?(?![\d)])/g;
    expect(DECK.match(hardcodedMoney) || []).toEqual([]);
  });

  it('renders every vertical as a slide rather than a curated subset', () => {
    // Dropping the weak ones for a pitch is the exact edit this guard exists to catch.
    expect(DECK).toContain('verticals.map');
  });

  // ── Shareable, and honestly so ────────────────────────────────────────────

  it('is readable without an account — the plan and the deck both', () => {
    // The whole point of the move. A `return <Forbidden/>` here means it went back to being
    // a page that can be presented but not sent.
    expect(PAGE).not.toMatch(/if \(!admin\) return/);
    expect(DECK_PAGE).not.toContain('getAdminUser');
  });

  it('is unlisted: public URL, invisible to search', () => {
    for (const src of [PAGE, DECK_PAGE]) expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('hides exactly one thing from the reader, and it is the operator panel', () => {
    // The load-bearing guard. Each additional `isAdmin &&` is a chance for an unflattering
    // fact to move behind the login, and nothing about that edit would look wrong in review.
    const gates = BODY.match(/isAdmin\s*&&/g) || [];
    expect(gates).toHaveLength(1);
    expect(BODY).toMatch(/\{isAdmin && <OperatorPanel/);
    // ...and no second way of gating that would slip past the count above.
    expect(BODY).not.toContain('getAdminUser');
    expect(BODY).not.toMatch(/isAdmin\s*\?/);
  });

  it('would catch a second gate — this matcher is not inert', () => {
    expect(('{isAdmin && <Revenue/>}\n{isAdmin && <Churn/>}'.match(/isAdmin\s*&&/g) || []).length).toBe(2);
  });

  it('keeps every unflattering column on the public half of the page', () => {
    // "Not proven", the stage badge and the honest-position block are what make this document
    // survive diligence. If they ever move into the operator panel, the public page becomes a
    // brochure and the reader has no way to tell.
    expect(BODY).toContain('vertical.unproven.map');
    expect(BODY).toContain('Not proven');
    expect(BODY).toContain('Where this actually stands');
    expect(BODY).toContain('STAGE_LABEL[vertical.stage]');

    const operatorMarkup = rendered(OPERATOR);
    expect(operatorMarkup).not.toContain('unproven');
    expect(operatorMarkup).not.toContain('Not proven');
    expect(operatorMarkup).not.toContain('STAGE_LABEL');
  });

  it('leaves no second copy of the plan behind at the old admin routes', () => {
    // Two pages rendering the same plan drift, and the admin one is the copy nobody proofreads
    // because everyone reads the shared link.
    for (const p of ['app/admin/business-plan/page.tsx', 'app/admin/business-plan/deck/page.tsx']) {
      const src = read(p);
      expect(src).toContain('redirect(');
      expect(src).not.toContain('VERTICALS');
    }
  });
});
