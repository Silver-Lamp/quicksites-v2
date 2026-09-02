/**
 * Guards on the sales lane data and the live call sheet.
 *
 * These are about the two ways this specific thing fails: a rep saying something we cannot
 * back, and a reference page that stops working at the moment it is needed.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { GEO_DOMAIN_RENTAL_LANE as LANE } from '@/lib/sales/lanes/geoDomainRental';
import { toEngineLaneSpec } from '@/lib/sales/laneSpec';

const PAGE = readFileSync(join(process.cwd(), 'app/for-sales/call/page.tsx'), 'utf8');

/** A promise is a second-person future claim. "Page one" as a PRICE fact is not one. */
const PROMISE = /\byou'?ll\b|\byou will\b|\bguarantee\b|\bguaranteed\b/i;

describe('geo domain rental lane', () => {
  it('gives every objection a move and a trap, with unique ids', () => {
    // The id is what the practice engine echoes back so the rehearsed branch and the branch on
    // the call sheet are the same branch. Duplicates silently merge two of them.
    const ids = LANE.objections.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of LANE.objections) {
      expect(o.says.trim().length).toBeGreaterThan(0);
      expect(o.goodMove.trim().length).toBeGreaterThan(0);
      expect(o.trap.trim().length).toBeGreaterThan(0);
    }
  });

  it('never coaches a rep into a promise', () => {
    // The one rule the brief is strict about. `violatingExamples` are exempt by design — they
    // exist to BE the bad phrasings, for the engine's few-shot and the rep's eye.
    const coaching = [
      ...LANE.objections.map((o) => o.goodMove),
      ...LANE.steps.map((s) => s.say ?? ''),
      ...LANE.trueClaims,
    ];
    for (const line of coaching) expect(line).not.toMatch(PROMISE);
  });

  it('would catch a promise — the matcher is not inert', () => {
    expect(PROMISE.test("this'll get you on page one and you'll see calls in a week")).toBe(true);
    expect(PROMISE.test('guaranteed page one placement')).toBe(true);
    // ...and does not fire on the true price fact, which mentions page one legitimately.
    expect(PROMISE.test('$399/month once a domain reaches page one; your rate is locked')).toBe(
      false
    );
  });

  it('keeps the no-promise rule first, and armed with real phrasings', () => {
    // The call sheet pins honestyRules[0] to the top of the page. If the order changes, the
    // banner quietly starts advertising a lesser rule.
    expect(LANE.honestyRules[0].id).toBe('no_ranking_promise');
    expect(LANE.honestyRules[0].violatingExamples.length).toBeGreaterThanOrEqual(2);
    for (const r of LANE.honestyRules) {
      expect(r.violatingExamples.length).toBeGreaterThan(0);
      for (const ex of r.violatingExamples) expect(ex.trim().length).toBeGreaterThan(0);
    }
  });

  it('quotes prices from the pricing config, never as literals in the prose', () => {
    // A stale price quoted at a live prospect is a real cost. Everything money-shaped is
    // derived from priceTier(), so a change is one edit.
    const src = readFileSync(join(process.cwd(), 'lib/sales/lanes/geoDomainRental.ts'), 'utf8');
    // Strips whole-line AND trailing comments: the first version of this test missed
    // `// $99.00` sitting after a derived constant, which is precisely the frozen number the
    // derivation exists to prevent.
    const body = src
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .filter((l) => !/^\s*(\/\*|\*)/.test(l))
      .join('\n');
    expect(body).toContain('priceTier(');
    expect(body.match(/\$\d[\d,]*(\.\d{2})?/g) || []).toEqual([]);
  });

  it('names no real prospect anywhere in the lane', () => {
    // Contract rehearsal-engine.md §4: the engine must never learn who is being called, and
    // the lane is what gets sent. Archetypes are types of people; a phone number or an email
    // in here would ride along to a model provider's logs.
    const blob = JSON.stringify(LANE);
    expect(blob).not.toMatch(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/); // phone
    expect(blob).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i); // email
  });
});

describe('engine hand-off shape', () => {
  it('emits the snake_case contract shape, with no camelCase leaking through', () => {
    const spec = toEngineLaneSpec(LANE);
    expect(Object.keys(spec).sort()).toEqual(['archetypes', 'honesty_rules', 'lane', 'objections']);
    expect(spec.objections[0]).toHaveProperty('good_move');
    expect(spec.honesty_rules[0]).toHaveProperty('violating_examples');
    expect(spec.archetypes[0]).toHaveProperty('opening_state');
    const blob = JSON.stringify(spec);
    for (const leak of ['goodMove', 'violatingExamples', 'openingState', 'trueClaims', 'steps']) {
      expect(blob).not.toContain(leak);
    }
  });
});

describe('call sheet works when everything else does not', () => {
  it('is a server component with no client runtime and no network call', () => {
    // The page is read mid-call, possibly on one bar of signal. Anything that fetches, hydrates
    // or lazy-loads is a blank panel at the exact moment it matters — and it would look fine in
    // every test that renders it on a good connection.
    expect(PAGE).not.toContain("'use client'");
    expect(PAGE).not.toMatch(/\bfetch\(/);
    expect(PAGE).not.toMatch(/useEffect|useState|dynamic\(/);
    expect(PAGE).not.toMatch(/from '@\/lib\/supabase/);
    expect(PAGE).toContain("from '@/lib/sales/lanes/geoDomainRental'");
  });

  it('prints as ink on paper, not as a black rectangle', () => {
    // The page is dark, like the rest of the app chrome. Printed as-is that is either a solid
    // black page or white-on-white, and a printed call sheet is the whole point of the format.
    expect(PAGE).toContain('@media print');
    expect(PAGE).toMatch(/background:\s*#fff/);
    expect(PAGE).toMatch(/break-inside:\s*avoid/);
  });

  it('shows everything at once — no accordions on a page read mid-sentence', () => {
    expect(PAGE).not.toContain('<details');
    expect(PAGE).not.toContain('<summary');
  });
});
