/** @jest-environment node */
// Truncation must not manufacture validity.
//
// ⚠️ THE LIVE BUG. `normalizeCode` ends with `.slice(0, CODE_LEN)` — forgiving for something a
// human typed, catastrophic applied to a URL segment. It turned any long word into a legal code
// as soon as its first six alphabet-legal characters happened to be legal:
//
//     'yard-sale'    → 'YARDSA'  accepted → swallowed /yard-sale/new, the self-serve front door
//     'garage-sales' → 'GARAGE'  accepted → swallows the directory at its own path
//     'privacy'      → 'PRIVAC'  rejected — but ONLY because 'I' is absent from the alphabet
//
// So the pages that worked were surviving by luck. Verified live: `yardsalesites.com/yard-sale/new`
// returned **200** and served "We don't recognise that code" — a page that exists, on a host built
// to serve it, reported as a bad sticker.
//
// Two things made it hard to see. The code branch in middleware runs BEFORE the apex-page
// allowlist, so adding a page to that set cannot rescue it — which is exactly the fix I tried
// first, and it changed nothing. And the wrong answer was a 200 rather than a 404, so every
// availability check said the route was fine.

import { isCodeShapedSegment, normalizeCode, isPlausibleCode } from '../codes';
import { yardSaleCodeFromPath } from '../yardSaleSites';

describe('isCodeShapedSegment', () => {
  it('rejects the words that were being eaten', () => {
    expect(isCodeShapedSegment('yard-sale')).toBe(false);
    expect(isCodeShapedSegment('garage-sales')).toBe(false);
  });

  it('rejects the pages that were only safe by accident', () => {
    // These already worked — because they happen to contain excluded letters or are short.
    // Pinning them means the rule now protects them instead of luck.
    for (const seg of ['privacy', 'terms', 'about', 'new', 'sitemap', 'pricing']) {
      expect(isCodeShapedSegment(seg)).toBe(false);
    }
  });

  it('accepts a real code, in every form a sticker or a person produces', () => {
    expect(isCodeShapedSegment('PQ8R4T')).toBe(true);
    expect(isCodeShapedSegment('PQ8-R4T')).toBe(true); // the printed display form
    expect(isCodeShapedSegment('pq8r4t')).toBe(true);  // typed lowercase
  });

  it('rejects a code with an excluded character rather than repairing it', () => {
    // O/0, I/1, L, U are absent from the alphabet so a typo is unresolvable — guessing would
    // claim someone ELSE's sticker, which is the one outcome worth avoiding.
    expect(isCodeShapedSegment('PQ8R4L')).toBe(false);
    expect(isCodeShapedSegment('PQ8R4O')).toBe(false);
  });

  it('is stricter than isPlausibleCode, which is the whole point', () => {
    // Documents the divergence deliberately: the truncating check still exists for typed input.
    expect(isPlausibleCode('yard-sale')).toBe(true);
    expect(isCodeShapedSegment('yard-sale')).toBe(false);
    expect(normalizeCode('yard-sale')).toBe('YARDSA');
  });
});

describe('yardSaleCodeFromPath', () => {
  it('does not claim a page path as a code', () => {
    expect(yardSaleCodeFromPath('/yard-sale/new')).toBeNull();
    expect(yardSaleCodeFromPath('/garage-sales')).toBeNull();
    expect(yardSaleCodeFromPath('/privacy')).toBeNull();
  });

  it('still resolves a real sale link', () => {
    expect(yardSaleCodeFromPath('/PQ8R4T')).toBe('PQ8R4T');
    expect(yardSaleCodeFromPath('/PQ8-R4T')).toBe('PQ8R4T');
  });

  it('returns null for the root, where there is no segment', () => {
    expect(yardSaleCodeFromPath('/')).toBeNull();
    expect(yardSaleCodeFromPath('')).toBeNull();
  });
});
