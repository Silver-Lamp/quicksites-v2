/**
 * @jest-environment node
 */
// lib/builder/__tests__/scaffoldValidates.test.ts
//
// ⚠️ A NEW SITE MUST NOT BE BORN INVALID, AND NOTHING CHECKED THAT UNTIL NOW.
//
// Seen live in a demo on 2026-09-30: a guest created "Joe's Haircuts", and the first thing on
// screen above a site they had not touched was a red box —
//
//     Some block(s) have validation errors
//     Block testimonial … Must include at least 1 item   content.testimonials   too_small
//
// Neither half was wrong on its own. `industryScaffold.ts` seeds the testimonial block EMPTY on
// purpose: it used to carry invented quotes interpolating the real business name, which on an
// auto-built site for a real named business is a fabricated review. And the block schema
// required at least one testimonial. Two deliberate, defensible decisions that contradicted —
// and nothing ran the output of one through the other.
//
// ⚠️ THIS IS THE GUARD, NOT THE `.min(1)` REMOVAL. Fixing the testimonial block fixes today's
// error; this test is what catches the next scaffold/schema disagreement, which will look
// exactly as reasonable from each side.
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { KEY_TO_LABEL } from '@/lib/industries';
import { validateBlock } from '@/lib/validateBlock';
import type { IndustryKey } from '@/lib/industries';

const INDUSTRIES = Object.keys(KEY_TO_LABEL) as IndustryKey[];

/** Every block on every page, whichever array the template put it in (CLAUDE.md §8). */
function allBlocks(tpl: any): any[] {
  const out: any[] = [];
  for (const page of tpl?.data?.pages ?? tpl?.pages ?? []) {
    for (const b of page?.content_blocks ?? []) out.push(b);
    for (const b of page?.blocks ?? []) out.push(b);
  }
  return out;
}

describe('every industry starter is valid the moment it is created', () => {
  it('covers a non-empty set of industries', () => {
    // A sweep that silently matches nothing reports success — the repo has been caught by that
    // shape before (verify:assets, the sectionShell colour test).
    expect(INDUSTRIES.length).toBeGreaterThan(5);
  });

  it.each(INDUSTRIES)('%s starts with no validation errors', (key) => {
    const tpl = buildIndustryStarter({ businessName: "Joe's Haircuts", industryKey: key });
    const blocks = allBlocks(tpl);
    expect(blocks.length).toBeGreaterThan(0);

    const failures = blocks
      .map((b) => ({ type: b?.type, errors: validateBlock(b) }))
      .filter((x) => x.errors.length > 0);

    // Named in the message: "3 blocks failed" sends you hunting; the type and the message do not.
    expect(
      failures.map((f) => `${f.type}: ${f.errors.join('; ')}`).join('\n'),
    ).toBe('');
  });
});

describe('the specific disagreement this was found by', () => {
  it('seeds a testimonial block with no testimonials, and that is valid', () => {
    const tpl = buildIndustryStarter({ businessName: 'Joe’s Haircuts', industryKey: 'barber' as IndustryKey });
    const testimonial = allBlocks(tpl).find((b) => b?.type === 'testimonial');
    // ⚠️ If a future change makes the scaffold seed quotes again, this fails — and it should.
    // The emptiness is the honesty decision, not an oversight to be tidied away.
    if (testimonial) {
      expect(testimonial.content?.testimonials ?? []).toHaveLength(0);
      expect(validateBlock(testimonial)).toEqual([]);
    }
  });
});
