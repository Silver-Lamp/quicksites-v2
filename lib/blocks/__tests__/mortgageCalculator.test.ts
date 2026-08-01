/**
 * @jest-environment node
 */
// A monthly-payment figure on a real estate site is a number a buyer may act on. It is not a
// loan offer, and it must never read as one — so the disclaimer is load-bearing, not decoration.
//
// Re-applied from PR #536 (opened 2026-07-18, conflicting by the time it was reviewed). Only the
// block was taken; the branch's wider scaffold rework was left behind because it predated
// home_valuation / affordability_calculator / listing_alert and would have reverted them, and
// because it seeded a placeholder paragraph ("A little about who you are, how you work…") of
// exactly the kind that shipped to visitors three separate times this week.
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { DEFAULT_BLOCK_CONTENT } from '../defaultBlockContent';

const schema = (blockContentSchemaMap as any).mortgage_calculator.schema;

describe('mortgage_calculator states what it is', () => {
  it('always carries a disclaimer, even from an empty object', () => {
    const parsed = schema.parse({});
    expect(parsed.disclaimer).toBeTruthy();
    expect(parsed.disclaimer.toLowerCase()).toContain('estimate');
  });

  it('says it is not a loan offer', () => {
    // The specific claim a buyer must not take away from a calculator on an agent's website.
    expect(schema.parse({}).disclaimer.toLowerCase()).toMatch(/not a loan offer|not a commitment/);
  });

  it('keeps the disclaimer in the shipped default too', () => {
    const d = (DEFAULT_BLOCK_CONTENT as any).mortgage_calculator;
    expect(d?.disclaimer).toBeTruthy();
  });

  it('the renderer prints it unconditionally', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'components/admin/templates/render-blocks/mortgage-calculator.tsx'),
      'utf8',
    );
    // Not inside a `{cond && …}` — a disclaimer you can switch off is not a disclaimer.
    expect(src).toMatch(/\{disclaimer\}/);
    expect(src).not.toMatch(/\{\s*\w+\s*&&\s*disclaimer\s*\}/);
  });
});

describe('the seeded numbers are a starting point, not a quote', () => {
  it('exposes rate and term as editable inputs rather than fixed copy', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'components/admin/templates/render-blocks/mortgage-calculator.tsx'),
      'utf8',
    );
    // A hard-coded rate presented as "today's rate" goes stale the day after it ships — the
    // same failure the menu index avoids by refusing to quote a price it cannot date.
    expect(src).toContain('setRate');
    expect(src).not.toMatch(/today'?s rate|current rate as of/i);
  });

  it('is not a duplicate of affordability_calculator', () => {
    // Different questions: affordability is income → price; this is price → payment.
    expect((blockContentSchemaMap as any).affordability_calculator).toBeDefined();
    const mc = Object.keys(schema.parse({}));
    expect(mc).toContain('loan_term_years');
    expect(mc).toContain('interest_rate');
  });
});
