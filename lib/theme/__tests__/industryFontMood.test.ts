// Industry → mood → typeface.
//
// ⚠️ 2,452 of 3,231 templates (76%) had no fontPair and rendered in `ui-sans-serif` — the
// system stack, i.e. no typographic choice at all — while eleven curated pairings, a loader and
// a `mood` on every pairing sat unused. The category axis existed; nothing mapped an industry
// to it.

import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';
import {
  INDUSTRY_FONT_MOOD,
  DEFAULT_FONT_MOOD,
  pairingsForMood,
  fontPairForIndustry,
} from '@/lib/theme/industryFontMood';

describe('every industry resolves to a real pairing', () => {
  // ⚠️ The one property that is not taste: a site must never fall back to the system font.
  it('resolves for every mapped industry', () => {
    for (const industry of Object.keys(INDUSTRY_FONT_MOOD)) {
      const id = fontPairForIndustry(industry, industry);
      expect(id).toBeTruthy();
      expect(FONT_PAIRINGS[id!]).toBeDefined();
    }
  });

  it('resolves for an industry nobody mapped, and for nothing at all', () => {
    // A new industry gets a typeface the day it is added, not the system stack.
    for (const i of ['a_brand_new_trade', '', null, undefined]) {
      const id = fontPairForIndustry(i as any, 'seed');
      expect(FONT_PAIRINGS[id!]).toBeDefined();
    }
  });

  it('every mood in the table has at least one pairing', () => {
    const moods = new Set([...Object.values(INDUSTRY_FONT_MOOD), DEFAULT_FONT_MOOD]);
    expect(moods.size).toBeGreaterThan(3); // the matcher is not inert
    for (const m of moods) expect(pairingsForMood(m!).length).toBeGreaterThan(0);
  });
});

describe('the owner’s named verticals read as editorial', () => {
  it.each(['author', 'photography', 'personal'])('%s', (k) => {
    expect(INDUSTRY_FONT_MOOD[k as never]).toBe('editorial');
  });
});

describe('deterministic, not random', () => {
  // ⚠️ A random pick would re-theme a published site on every rebuild — a visual change nobody
  // asked for, on somebody else's live business.
  it('the same site always gets the same face', () => {
    const a = fontPairForIndustry('towing', 'belmont-towing');
    for (let i = 0; i < 20; i++) {
      expect(fontPairForIndustry('towing', 'belmont-towing')).toBe(a);
    }
  });

  it('spreads sites in one mood across its pairings', () => {
    // Two towing sites in one town should not be visibly the same template.
    const ids = new Set(
      Array.from({ length: 40 }, (_, i) => fontPairForIndustry('legal', `firm-${i}`)),
    );
    const available = pairingsForMood('elegant').length;
    if (available > 1) expect(ids.size).toBeGreaterThan(1);
  });

  it('is stable without a seed too', () => {
    expect(fontPairForIndustry('legal')).toBe(fontPairForIndustry('legal'));
  });
});
