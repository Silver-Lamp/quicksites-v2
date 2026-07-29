import { looseMatch, tokensAgree, tokenize, editDistanceWithin } from '../looseMatch';

describe('looseMatch', () => {
  // The cases this exists for: real menu text, OCR'd off photographs, half transliterated.
  it('matches common transliteration variance', () => {
    expect(looseMatch('pad thai', 'Phad Thai')).toBe(true);
    expect(looseMatch('bulgogi', 'Bul-Go-Gi Beef')).toBe(false); // token split ≠ same word
    expect(looseMatch('bul go gi', 'Bul-Go-Gi Beef')).toBe(true);
    expect(looseMatch('banh mi', 'Bahn Mi Sandwich')).toBe(true);
  });

  it('ignores punctuation and casing', () => {
    expect(looseMatch('creme brulee', 'Crème Brûlée'.normalize('NFD').replace(/[̀-ͯ]/g, ''))).toBe(true);
    expect(looseMatch('mac n cheese', 'Mac & Cheese')).toBe(false); // "n" has no counterpart
  });

  it('handles pluralisation by prefix', () => {
    expect(looseMatch('noodle', 'Mushroom Noodles')).toBe(true);
    expect(looseMatch('noodles', 'Mushroom Noodle Bowl')).toBe(true);
  });

  // ⚠️ The conservative direction is load-bearing: a false "it's just a naming problem" would
  // reclassify genuine unmet demand as a spelling bug and hide the very signal we're measuring.
  // Insertions and adjacent swaps are what transliteration and typing actually do. Neither
  // can turn a word into an unrelated one, so both are safe at any length — unlike a
  // substitution, which is how cat becomes bat.
  it('allows one-letter insertions and adjacent swaps at any length', () => {
    expect(tokensAgree('pad', 'phad')).toBe(true);   // insertion
    expect(tokensAgree('banh', 'bahn')).toBe(true);  // adjacent swap
    expect(tokensAgree('form', 'from')).toBe(true);  // the same operation, unavoidably
  });

  it('refuses SUBSTITUTIONS in short tokens, where edit-1 is noise', () => {
    expect(tokensAgree('cat', 'bat')).toBe(false);
    // Pluralisation IS a legitimate match — it's a one-letter insertion, not a substitution.
    expect(tokensAgree('oat', 'oats')).toBe(true);
    expect(looseMatch('pho', 'Phu Quoc Crab')).toBe(false);
  });

  it('keeps AND semantics — loosening spelling is not loosening logic', () => {
    expect(looseMatch('vegan pad thai', 'Phad Thai')).toBe(false); // no "vegan" anywhere
    expect(looseMatch('vegan pad thai', 'Vegan Phad Thai')).toBe(true);
  });

  it('does not match unrelated dishes', () => {
    expect(looseMatch('biryani', 'Beef Birria Tacos')).toBe(false);
    expect(looseMatch('pad thai', 'Dan Dan Noodles')).toBe(false);
  });

  it('drops stopwords rather than requiring them', () => {
    expect(tokenize('bowl of the noodles')).toEqual(['bowl', 'noodles']);
    expect(looseMatch('bowl of noodles', 'Noodle Bowl')).toBe(true);
  });

  it('edit distance bails early instead of scanning hopeless pairs', () => {
    expect(editDistanceWithin('pad', 'phad', 1)).toBe(true);
    expect(editDistanceWithin('pad', 'bread', 1)).toBe(false);
    expect(editDistanceWithin('a', 'abcdefg', 1)).toBe(false);
  });

  it('is empty-safe', () => {
    expect(looseMatch('', 'anything')).toBe(false);
    expect(looseMatch('pad thai', '')).toBe(false);
  });
});
