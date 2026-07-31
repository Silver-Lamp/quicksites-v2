// The marketing page must not be able to quote a rate nobody charges.
//
// /pricing declared its own `const ORDER_FEE_PCT = 0.05`, so it could never be *wrong* about
// 5% — it defined its own 5% — and it had no idea RESTAURANT_FEE_PERCENT existed. The page
// therefore said "5% per order — that's it" four times, while any site with a `menu` block is
// seeded 8% + 60¢ automatically by resolveMerchantFeeDefault(). A visitor in the vertical we
// market hardest was reading a number nobody would charge them.
//
// The page now imports the constants, which removes the drift at its source. This pins the
// second half: the page must also SAY the food rate, so importing the right number can't be
// mistaken for disclosing it. Deleting the mention would leave the page technically accurate
// about 5% and silent about the 8% — the exact shape of the original bug.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GENERAL_FEE_PERCENT,
  RESTAURANT_FEE_PERCENT,
  RESTAURANT_FEE_MIN_CENTS,
} from '../pricingPolicy';

const page = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8');

describe('/pricing cannot drift from the fee policy', () => {
  it('imports the rates instead of restating them', () => {
    expect(page).toContain("from '@/lib/commerce/pricingPolicy'");
    // The literal that caused this: a private copy of the general rate.
    // ⚠️ Anchored to line start on purpose — the unanchored version matched the COMMENT in
    // page.tsx that quotes the old declaration to explain why it was removed. A test that
    // fails on a file explaining the bug is a test that pressures you to delete the
    // explanation, which is the last thing anyone should be nudged toward.
    expect(page).not.toMatch(/^const ORDER_FEE_PCT\s*=\s*0\.\d+/m);
  });

  it('mentions the food rate somewhere a reader will meet it', () => {
    expect(page).toMatch(/FOOD_FEE_PCT/);
    expect(page).toMatch(/FOOD_FEE_MIN/);
  });

  it('answers the food rate in the FAQ, where someone goes to check', () => {
    expect(page).toMatch(/restaurant or food-ordering site/i);
    // The actual numbers, so a policy change without a copy change is caught.
    expect(page).toContain(`${Math.round(RESTAURANT_FEE_PERCENT * 100)}%`);
    expect(page).toContain(`${RESTAURANT_FEE_MIN_CENTS}¢`);
  });

  // If these defaults ever change, this test fails and forces the prose to be re-read rather
  // than left quietly stale.
  it('pins the defaults the copy was written against', () => {
    expect(GENERAL_FEE_PERCENT).toBeCloseTo(0.05);
    expect(RESTAURANT_FEE_PERCENT).toBeCloseTo(0.08);
    expect(RESTAURANT_FEE_MIN_CENTS).toBe(60);
  });
});
