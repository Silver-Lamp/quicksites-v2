/**
 * @jest-environment node
 */
import {
  TREEHOUSE_BUILDERS,
  buildersForState,
  isFirstHand,
  stateCoverage,
} from '@/lib/treehouseBuilders/builders';

describe('every entry is sourced', () => {
  it('has a source with a url, a note and a read date', () => {
    for (const b of TREEHOUSE_BUILDERS) {
      expect(b.sources.length).toBeGreaterThan(0);
      for (const s of b.sources) {
        expect(s.url).toMatch(/^https?:\/\//);
        expect(s.note.length).toBeGreaterThan(15);
        expect(s.read).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('ids are unique — a duplicate would list a builder twice on one page', () => {
    const ids = TREEHOUSE_BUILDERS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('no safety, licensing or insurance claims', () => {
  // These are structures children climb into. Repeating a company's own safety claim on our
  // page makes it OUR claim about someone else's work.
  it('nothing in the registry asserts safety, licensing, insurance or a guarantee', () => {
    const forbidden = /\b(safe|safety|certified|licensed|insured|guarantee|warrantied|bonded)\b/i;
    for (const b of TREEHOUSE_BUILDERS) {
      expect(b.summary).not.toMatch(forbidden);
      expect(b.pricingNote ?? '').not.toMatch(forbidden);
    }
  });
});

describe('servesStates is only what a company says about itself', () => {
  it('a builder with a state list also carries the quote it came from', () => {
    for (const b of TREEHOUSE_BUILDERS) {
      if (b.servesStates.length) expect(b.serviceAreaQuote).toBeTruthy();
    }
  });

  it('"around the world" and "all across the country" are NOT state lists', () => {
    // Nelson says "around the world", The Treehouse Guys "all across the country". Neither
    // names a state, so neither may populate one — that is the inference this guards against.
    for (const id of ['nelson-treehouse', 'the-treehouse-guys', 'tree-top-builders']) {
      const b = TREEHOUSE_BUILDERS.find((x) => x.id === id)!;
      expect(b.servesStates).toEqual([]);
    }
  });

  it('Treehouse Experts’ eight states come from their own sentence', () => {
    const b = TREEHOUSE_BUILDERS.find((x) => x.id === 'treehouse-experts')!;
    expect(b.servesStates).toEqual(['GA', 'TN', 'FL', 'AL', 'SC', 'NC', 'NJ', 'CT']);
    for (const code of ['Tennessee', 'North Carolina', 'Georgia']) {
      expect(b.serviceAreaQuote).toContain(code);
    }
  });
});

describe('state coverage decides which domains are worth buying', () => {
  it('counts based-here and serves-here without double counting', () => {
    const nc = buildersForState('NC');
    expect(nc.basedHere.map((b) => b.id)).toContain('creative-treehouse-design');
    expect(nc.servesHere.map((b) => b.id)).toContain('treehouse-experts');
    // A builder based in a state must not also appear as "serves" it.
    const ga = buildersForState('GA');
    expect(ga.servesHere.map((b) => b.id)).not.toContain('treehouse-experts');
    expect(stateCoverage('NC')).toBe(nc.basedHere.length + nc.servesHere.length);
  });

  it('Tennessee has no builder based there — the page would rest on one travelling firm', () => {
    expect(buildersForState('TN').basedHere).toEqual([]);
    expect(stateCoverage('TN')).toBe(1);
  });
});

describe('first-hand vs directory listings are distinguishable', () => {
  it('flags entries whose own site has not been read', () => {
    const firstHand = TREEHOUSE_BUILDERS.filter(isFirstHand);
    expect(firstHand.length).toBeGreaterThan(0);
    expect(firstHand.length).toBeLessThan(TREEHOUSE_BUILDERS.length);
    // A directory-only entry is weaker evidence and the page must be able to say so.
    expect(isFirstHand(TREEHOUSE_BUILDERS.find((b) => b.id === 'treehouse-experts')!)).toBe(true);
    expect(isFirstHand(TREEHOUSE_BUILDERS.find((b) => b.id === 'artistree')!)).toBe(false);
  });
});
