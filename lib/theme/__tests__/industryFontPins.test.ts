/**
 * @jest-environment node
 */
// ⚠️ node, not jsdom: the scaffold calls crypto.randomUUID, which jsdom lacks. Same reason
// scaffoldValidates.test.ts pins its environment.
// Superadmin pins over the mood table.

import { fontPairForIndustry } from '@/lib/theme/industryFontMood';
import { sanitizePins } from '@/lib/theme/industryFontOverrides';
import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { CURATED_THEMES } from '@/lib/theme/curatedThemes';

describe('an approved pool narrows the choice without fixing it', () => {
  const POOL = { towing: ['playfair-source', 'lora-inter'] };

  it('only ever draws from the pool', () => {
    for (let i = 0; i < 50; i++) {
      expect(POOL.towing).toContain(fontPairForIndustry('towing', `site-${i}`, POOL));
    }
  });

  // ⚠️ THE WHOLE POINT. One face per industry makes every towing site in a town identical —
  // the "obviously a template" tell. The pool must actually spread.
  it('spreads across the pool', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => fontPairForIndustry('towing', `site-${i}`, POOL)));
    expect(seen.size).toBe(2);
  });

  it('is stable for one site', () => {
    const a = fontPairForIndustry('towing', 'belmont-towing', POOL);
    for (let i = 0; i < 20; i++) expect(fontPairForIndustry('towing', 'belmont-towing', POOL)).toBe(a);
  });

  it('a pool of one behaves like a hard pin', () => {
    const one = { towing: ['lora-inter'] };
    expect(fontPairForIndustry('towing', 'a', one)).toBe('lora-inter');
    expect(fontPairForIndustry('towing', 'b', one)).toBe('lora-inter');
  });

  it('leaves industries with no pool on the mood table', () => {
    const legal = fontPairForIndustry('legal', 'x', POOL);
    expect(POOL.towing).not.toContain(legal);
    expect(FONT_PAIRINGS[legal!]?.mood).toBe('elegant');
  });
});

describe('sanitizePins', () => {
  // ⚠️ Validated on READ. A pairing renamed in code leaves a pin naming something that no
  // longer exists; serving it resolves to NO font — the system-stack bug this all exists to fix.
  it('drops entries naming a pairing that no longer exists', () => {
    expect(sanitizePins({ towing: ['a-removed-pairing'] })).toEqual({});
    // and prunes just the dead one from a mixed pool
    expect(sanitizePins({ towing: ['archivo-inter', 'gone'] })).toEqual({ towing: ['archivo-inter'] });
  });

  // ⚠️ The first version of this feature stored ONE pairing per industry as a bare string.
  // Rows written then must keep working rather than silently resolving to no font.
  it('accepts the legacy single-string shape', () => {
    expect(sanitizePins({ towing: 'archivo-inter' })).toEqual({ towing: ['archivo-inter'] });
  });

  it('dedupes, and ignores junk', () => {
    expect(sanitizePins({ towing: ['archivo-inter', 'archivo-inter'] })).toEqual({ towing: ['archivo-inter'] });
    expect(sanitizePins({ '': ['lora-inter'], legal: 42 })).toEqual({});
    expect(sanitizePins(null)).toEqual({});
    expect(sanitizePins('nope')).toEqual({});
  });
});

describe('the scaffold honours a pin, and only a pin', () => {
  const pairOf = (opts: any) =>
    (buildIndustryStarter(opts) as any).data.meta.theme.fontPair;

  it('uses the pooled pairing when given one', () => {
    expect(pairOf({ businessName: 'T', industryKey: 'towing', fontPair: 'playfair-source' }))
      .toBe('playfair-source');
  });

  // ⚠️ THE BUG THIS CATCHES. Passing `fontPairForIndustry`'s answer unconditionally would
  // override the CURATED THEME's pairing on every new site — swapping a designed combination
  // for a generic one, for industries nobody has an opinion about. Absence of a pin must
  // leave the theme alone.
  it('leaves the curated theme alone when there is no pin', () => {
    // ⚠️ A FIXED themeId. `pickCuratedTheme` is deliberately random so sites in one trade do
    // not look alike, so two unpinned calls legitimately differ — comparing them tested the
    // randomiser, not the pin. Fix the theme and the comparison means something.
    const FIXED = CURATED_THEMES[0].id;
    const withNull = pairOf({ businessName: 'T', industryKey: 'towing', themeId: FIXED, fontPair: null });
    const plain = pairOf({ businessName: 'T', industryKey: 'towing', themeId: FIXED });
    expect(withNull).toBe(plain);
    expect(withNull).toBe(CURATED_THEMES[0].fontPair);
  });

  it('a pin beats even an explicitly chosen theme', () => {
    const FIXED = CURATED_THEMES[0].id;
    expect(pairOf({ businessName: 'T', industryKey: 'towing', themeId: FIXED, fontPair: 'lora-inter' }))
      .toBe('lora-inter');
  });
});
