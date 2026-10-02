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

describe('a pin wins outright', () => {
  it('overrides the mood table', () => {
    const pins = { towing: 'playfair-source' };
    expect(fontPairForIndustry('towing', 'seed-a', pins)).toBe('playfair-source');
    // ⚠️ No seed spreading: the point of pinning is that every site in the trade matches.
    expect(fontPairForIndustry('towing', 'seed-b', pins)).toBe('playfair-source');
  });

  it('leaves unpinned industries on the mood table', () => {
    const pins = { towing: 'playfair-source' };
    const legal = fontPairForIndustry('legal', 'x', pins);
    expect(legal).not.toBe('playfair-source');
    expect(FONT_PAIRINGS[legal!]?.mood).toBe('elegant');
  });
});

describe('sanitizePins', () => {
  // ⚠️ Validated on READ. A pairing renamed in code leaves a pin naming something that no
  // longer exists; serving it resolves to NO font — the system-stack bug this all exists to fix.
  it('drops pins naming a pairing that no longer exists', () => {
    expect(sanitizePins({ towing: 'a-removed-pairing' })).toEqual({});
  });

  it('keeps valid ones and ignores junk', () => {
    expect(sanitizePins({ towing: 'archivo-inter', '': 'lora-inter', legal: 42 })).toEqual({
      towing: 'archivo-inter',
    });
    expect(sanitizePins(null)).toEqual({});
    expect(sanitizePins('nope')).toEqual({});
  });
});

describe('the scaffold honours a pin, and only a pin', () => {
  const pairOf = (opts: any) =>
    (buildIndustryStarter(opts) as any).data.meta.theme.fontPair;

  it('uses the pinned pairing when given one', () => {
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
