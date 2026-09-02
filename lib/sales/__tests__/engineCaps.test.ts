/**
 * The lane spec has to fit HiveJournal's engine limits, published in their 2026-09-02 message
 * and recorded in crosstalk/contracts/rehearsal-engine.md.
 *
 * ⚠️ Why this is a test and not a note: the caps live in someone else's service. Exceeding one
 * fails at a request we make during a rep's practice run — the far end of the loop, in front of
 * a person, long after the edit that caused it. A 41st objection is a perfectly reasonable thing
 * for a future session to add while improving the call sheet, and nothing about that edit would
 * look wrong here.
 *
 * If HJ raises a cap, change it here in the same commit that reads their message.
 */
import { GEO_DOMAIN_RENTAL_LANE } from '@/lib/sales/lanes/geoDomainRental';
import { toEngineLaneSpec } from '@/lib/sales/laneSpec';

// HJ's published caps. Named rather than inlined so the numbers are readable as their numbers.
const CAP = {
  objections: 40,
  objectionField: 300,
  honestyRules: 12,
  ruleText: 400,
  violatingExamples: 6,
  violatingExample: 160,
  archetypeTraits: 8,
  archetypeTrait: 120,
} as const;

const spec = toEngineLaneSpec(GEO_DOMAIN_RENTAL_LANE);

describe('lane spec fits the engine', () => {
  it('stays within the objection caps', () => {
    expect(spec.objections.length).toBeLessThanOrEqual(CAP.objections);
    for (const o of spec.objections) {
      for (const field of [o.says, o.good_move, o.trap]) {
        expect(field.length).toBeLessThanOrEqual(CAP.objectionField);
      }
    }
  });

  it('stays within the honesty-rule caps', () => {
    expect(spec.honesty_rules.length).toBeLessThanOrEqual(CAP.honestyRules);
    for (const r of spec.honesty_rules) {
      expect(r.rule.length).toBeLessThanOrEqual(CAP.ruleText);
      expect(r.violating_examples.length).toBeLessThanOrEqual(CAP.violatingExamples);
      for (const ex of r.violating_examples) {
        expect(ex.length).toBeLessThanOrEqual(CAP.violatingExample);
      }
    }
  });

  it('stays within the archetype caps', () => {
    for (const a of spec.archetypes) {
      expect(a.traits.length).toBeLessThanOrEqual(CAP.archetypeTraits);
      for (const t of a.traits) expect(t.length).toBeLessThanOrEqual(CAP.archetypeTrait);
    }
  });

  it('would catch an over-cap lane — the assertions are not vacuous', () => {
    // Guards the empty-collection case: a lane that lost its objections would pass every loop
    // above by iterating nothing, which is the same silence-looks-like-success shape as a
    // sweep that matches no files.
    expect(spec.objections.length).toBeGreaterThan(0);
    expect(spec.honesty_rules.length).toBeGreaterThan(0);
    expect(spec.archetypes.length).toBeGreaterThan(0);
    expect('x'.repeat(CAP.objectionField + 1).length).toBeGreaterThan(CAP.objectionField);
  });
});
