/**
 * @jest-environment node
 */
import { NICHE_CANDIDATES } from '@/lib/niches/candidates';
import {
  averagePerMetro,
  densityBand,
  rankNiches,
  scoreNiche,
  verdictFor,
} from '@/lib/niches/score';

const byKey = (k: string) => {
  const c = NICHE_CANDIDATES.find((x) => x.key === k);
  if (!c) throw new Error(`no candidate ${k}`);
  return c;
};

const metros = (counts: number[]) =>
  counts.map((count, i) => ({ city: `city${i}`, region: 'XX', count }));

describe('density bands are anchored to our own two cohorts', () => {
  it('towing measured 6.4 per city → dense; domes ~2 per state → thin', () => {
    expect(densityBand(6.4).label).toBe('dense');
    expect(densityBand(2).label).toBe('thin');
  });

  it('averages over the metros probed', () => {
    expect(averagePerMetro(metros([0, 1, 5]))).toBe(2);
    expect(averagePerMetro([])).toBe(0);
  });
});

describe('the controls behave as the record says', () => {
  // If these ever pass while the probe recommends towing, the probe is wrong, not the record.
  it('towing ranks last and is skipped on intent, even when supply reads thin', () => {
    const towing = scoreNiche(byKey('towing'), { key: 'towing', metros: metros([0, 0, 0]) });
    expect(towing.verdict).toMatch(/emergency/i);
    const domes = scoreNiche(byKey('dome_builder'), { key: 'dome_builder', metros: metros([1, 2, 0]) });
    expect(rankNiches([towing, domes])[0].key).toBe('dome_builder');
  });

  it('a saturated considered-intent niche is still skipped', () => {
    const decks = scoreNiche(byKey('deck_builder'), { key: 'deck_builder', metros: metros([40, 35, 50]) });
    expect(decks.density).toBe('saturated');
    expect(decks.verdict).toMatch(/saturated/i);
  });

  it('the dome benchmark clears the "go read a SERP" bar', () => {
    const domes = scoreNiche(byKey('dome_builder'), { key: 'dome_builder', metros: metros([2, 1, 3]) });
    expect(domes.score).toBeGreaterThanOrEqual(75);
    expect(domes.verdict).toMatch(/SERP/);
  });
});

describe('the verdict never implies more than we measured', () => {
  it('a top score says to read a SERP, never to buy', () => {
    const v = verdictFor(byKey('treehouse'), 'thin', 100);
    expect(v).toMatch(/SERP/i);
    expect(v).not.toMatch(/buy|purchase|register/i);
  });

  it('empty metros are counted and reported', () => {
    const s = scoreNiche(byKey('treehouse'), { key: 'treehouse', metros: metros([0, 0, 2]) });
    expect(s.emptyMetros).toBe(2);
    expect(s.metrosProbed).toBe(3);
  });
});

describe('the candidate list stays honest', () => {
  it('every candidate carries a note and at least one query', () => {
    for (const c of NICHE_CANDIDATES) {
      expect(c.note.length).toBeGreaterThan(20);
      expect(c.queries.length).toBeGreaterThan(0);
    }
  });

  it('keeps both controls — a probe with nothing to fail against proves nothing', () => {
    expect(NICHE_CANDIDATES.map((c) => c.key)).toEqual(expect.arrayContaining(['towing', 'deck_builder']));
  });

  it('ties break on the measured term, not the judged ones', () => {
    const a = { key: 'a', label: 'A', perMetro: 9, emptyMetros: 0, metrosProbed: 3, density: 'dense' as const, score: 50, verdict: '', note: '' };
    const b = { ...a, key: 'b', perMetro: 1, density: 'thin' as const };
    expect(rankNiches([a, b])[0].key).toBe('b');
  });
});
