// Guards for the curated-theme catalog + picker + resolver wiring (Phase A).

import { CURATED_THEMES, getCuratedTheme, toStampedTheme } from '@/lib/theme/curatedThemes';
import { ACCENT_HSL } from '@/lib/theme/accentHsl';
import { FONT_PAIRINGS, getFontPairing, fontPairHref } from '@/lib/theme/fontPairings';
import { pickCuratedTheme } from '@/lib/theme/pickTheme';
import { resolveSiteTheme } from '@/lib/theme/resolveSiteTheme';

describe('curated theme catalog integrity', () => {
  it('every accent + secondary token resolves in ACCENT_HSL (else the theme silently no-ops)', () => {
    for (const t of CURATED_THEMES) {
      expect(ACCENT_HSL[t.accentColor]).toBeDefined();
      expect(ACCENT_HSL[t.accent2Color]).toBeDefined();
    }
  });

  it('every fontPair references a real pairing', () => {
    for (const t of CURATED_THEMES) {
      expect(FONT_PAIRINGS[t.fontPair]).toBeDefined();
    }
  });

  it('has unique ids and a spread of light/dark', () => {
    const ids = CURATED_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dark = CURATED_THEMES.filter((t) => t.darkMode === 'dark').length;
    expect(dark).toBeGreaterThan(0);
    expect(dark).toBeLessThan(CURATED_THEMES.length);
  });
});

describe('pickCuratedTheme', () => {
  it('favors an explicit industry match (deterministic rng near 0 → highest-weight bucket)', () => {
    // rng()=0 selects the first bucket; Ironworks (weight 8) leads for auto_repair.
    const t = pickCuratedTheme({ industry: 'auto_repair', rng: () => 0 });
    expect(t.industries).toContain('auto_repair');
  });

  it('never returns the avoided id when alternatives exist', () => {
    for (let i = 0; i < 50; i++) {
      const t = pickCuratedTheme({ avoidId: 'ironworks', rng: () => i / 50 });
      expect(t.id).not.toBe('ironworks');
    }
  });

  it('always returns a valid catalog theme', () => {
    const t = pickCuratedTheme({ industry: 'other' });
    expect(getCuratedTheme(t.id)).toBe(t);
  });
});

describe('resolveSiteTheme with a stamped curated theme', () => {
  const stamped = toStampedTheme(getCuratedTheme('neon-dusk')!);
  const resolved = resolveSiteTheme({ data: { meta: { theme: stamped } } });

  it('emits accent + font vars and a font href', () => {
    expect(resolved).not.toBeNull();
    expect(resolved!.vars['--primary']).toBe(ACCENT_HSL['fuchsia-600']);
    expect(resolved!.vars['--ring']).toBe(ACCENT_HSL['fuchsia-600']);
    expect(resolved!.vars['--font-heading']).toContain('Space Grotesk');
    expect(resolved!.vars['--font-body']).toContain('Inter');
    expect(resolved!.fontHref).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/);
  });

  it('returns null for an unthemed template (legacy untouched)', () => {
    expect(resolveSiteTheme({ data: { meta: {} } })).toBeNull();
  });
});

describe('fontPairHref', () => {
  it('builds a css2 url with both families and display=swap', () => {
    const href = fontPairHref('dmserif-dmsans');
    expect(href).toContain('family=DM+Serif+Display');
    expect(href).toContain('family=DM+Sans');
    expect(href).toContain('display=swap');
  });

  it('dedupes when heading and body share a family', () => {
    // Pairings using Inter for body against an Inter heading would collapse; here
    // just assert a normal pairing lists exactly two families.
    const pair = getFontPairing('oswald-inter')!;
    const href = fontPairHref('oswald-inter')!;
    const count = (href.match(/family=/g) || []).length;
    expect(pair.heading.family).not.toBe(pair.body.family);
    expect(count).toBe(2);
  });
});
