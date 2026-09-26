/**
 * @jest-environment node
 *
 * Searching ~60 industries, and guessing one from a business name.
 *
 * ⚠️ The case that motivated this is the one the suggester must get RIGHT BY REFUSING:
 * "Joe's Ship Repair". We have no marine trade, and the word "repair" alone will happily drag it
 * to Auto Repair — confidently wrong, and wrong in a way that shapes the entire scaffold before
 * anyone notices.
 */
import { searchIndustries, suggestFromBusinessName } from '@/lib/industries/search';

describe('searchIndustries', () => {
  it('finds an exact label first', () => {
    expect(searchIndustries('Plumbing')[0].key).toBe('plumbing');
  });

  it('matches a prefix, which is what typing feels like', () => {
    expect(searchIndustries('plum')[0].key).toBe('plumbing');
    expect(searchIndustries('tow')[0].key).toBe('towing');
  });

  // ⚠️ The whole reason this is not a substring filter. None of these words appear in any label.
  it.each([
    ['ac', 'hvac'],
    ['air conditioning', 'hvac'],
    ['electrician', 'electrical'],
    ['power wash', 'pressure_washing'],
    ['exterminator', 'pest_control'],
    ['lawyer', 'legal'],
    ['dentist', 'medical_dental'],
    ['wrecker', 'towing'],
    ['auto glass', 'windshield_repair'],
  ])('finds %s via an alias → %s', (q, key) => {
    expect(searchIndustries(q)[0]?.key).toBe(key);
  });

  it('handles words in the wrong order', () => {
    expect(searchIndustries('repair auto')[0].key).toBe('auto_repair');
  });

  // ⚠️ The list carries several labels per key on purpose ("Window Washing" / "Window Cleaning").
  // Showing both makes the picker look broken.
  it('returns each industry at most once', () => {
    const keys = searchIndustries('window', 10).map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('says which word matched, so a surprising hit explains itself', () => {
    expect(searchIndustries('furnace')[0].via).toBe('furnace');
  });

  it('returns nothing for an empty query rather than the whole list', () => {
    expect(searchIndustries('')).toEqual([]);
    expect(searchIndustries('   ')).toEqual([]);
  });

  it('returns nothing for genuine nonsense', () => {
    expect(searchIndustries('qqqzzz')).toEqual([]);
  });
});

describe('suggestFromBusinessName', () => {
  it.each([
    ["Rivera's Plumbing & Drain", 'plumbing'],
    ['Grafton Towing', 'towing'],
    ['Spokane Pressure Washing', 'pressure_washing'],
    ['Arlington Heating & Air', 'hvac'],
    ['Attic & Anchor Antiques', 'antiques_vintage'],
  ])('guesses %s → %s', (name, key) => {
    const s = suggestFromBusinessName(name);
    expect(s.match?.key).toBe(key);
    expect(s.confidence).toBe('strong');
  });

  // ⚠️ THE ONE THAT MATTERS. No marine trade exists in our list, and "repair" on its own must not
  // be enough to make this an auto shop.
  it('refuses to turn "Joe\'s Ship Repair" into an auto shop', () => {
    const s = suggestFromBusinessName("Joe's Ship Repair");
    expect(s.match?.key).not.toBe('auto_repair');
    expect(s.confidence).not.toBe('strong');
  });

  it('gives nothing for a name with no trade in it', () => {
    const s = suggestFromBusinessName('Blue Harbor Collective');
    expect(s.confidence).toBe('none');
    expect(s.match).toBeNull();
  });

  it('ignores the noise words every business name carries', () => {
    // "LLC", "Services", "Pro" must not become the match.
    const s = suggestFromBusinessName('Pro Quality Services LLC');
    expect(s.confidence).toBe('none');
  });

  it('prefers the longer phrase — "auto glass" beats "auto"', () => {
    const s = suggestFromBusinessName('Cascade Auto Glass');
    expect(s.match?.key).toBe('windshield_repair');
  });

  it('reports what it matched on, for "because you wrote …"', () => {
    const s = suggestFromBusinessName('Grafton Towing');
    expect(s.because).toContain('towing');
  });

  it('survives an empty or punctuation-only name', () => {
    for (const n of ['', '   ', '&&&', "'"]) {
      expect(suggestFromBusinessName(n).confidence).toBe('none');
    }
  });
});

// ⚠️ The picker is a component; these read its source, because the property that matters is the
// WIRING — that a guess is offered rather than applied — and no unit test of the matcher can see it.
describe('the picker offers, never applies', () => {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const { stripComments } = require('@/test/stripComments');
  const SRC = stripComments(
    readFileSync(join(process.cwd(), 'components/admin/templates/industry-picker.tsx'), 'utf8'),
  );

  it('read a real file', () => {
    expect(SRC.length).toBeGreaterThan(2000);
  });

  it('never calls onChange from the suggestion automatically', () => {
    // The chip is a button. If the suggestion were applied in an effect, someone would find their
    // industry already chosen — and the scaffold already shaped — without having picked it.
    expect(SRC).not.toMatch(/useEffect\([^)]*\{[\s\S]{0,200}onChange\(suggestion/);
    expect(SRC).toMatch(/onClick=\{\(\) => pick\(suggestion\.match!\.key\)\}/);
  });

  it('only offers a STRONG suggestion', () => {
    expect(SRC).toMatch(/suggestion\.confidence === 'strong'/);
  });

  it('tells the person why it guessed', () => {
    expect(SRC).toMatch(/because you wrote/);
  });

  it('points at the Other field when nothing matches, instead of going blank', () => {
    expect(SRC).toMatch(/Nothing matches/);
    expect(SRC).toMatch(/Other/);
  });

  it('is keyboard-operable', () => {
    for (const k of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) expect(SRC).toContain(k);
  });
});
