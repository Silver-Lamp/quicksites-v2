/**
 * @jest-environment node
 */
// The accent's button text is chosen by CONTRAST, not by HSL lightness. White on lime-500 was
// 2.0:1 on the B Hard CTA (UX scan, 2026-10-16) because lime is L 44 and the old rule said
// "L < 62 → white".
import { ACCENT_HSL, FOREGROUND_DARK, FOREGROUND_LIGHT, contrastRatio, foregroundForHsl, relativeLuminance } from '@/lib/theme/accentHsl';

describe('foregroundForHsl picks the higher-contrast text', () => {
  it('lime-500 gets dark text (white was 2.0:1)', () => {
    const lime = ACCENT_HSL['lime-500'];
    expect(contrastRatio(lime, FOREGROUND_LIGHT)!).toBeLessThan(2.5);
    expect(contrastRatio(lime, FOREGROUND_DARK)!).toBeGreaterThan(8);
    expect(foregroundForHsl(lime)).toBe(FOREGROUND_DARK);
  });
  it.each(['yellow-500', 'amber-500', 'orange-500', 'pink-400', 'sky-500', 'teal-500', 'zinc-300'])('%s — white fails 3:1, so dark text', (k) => {
    expect(contrastRatio(ACCENT_HSL[k], FOREGROUND_LIGHT)!).toBeLessThan(3);
    expect(foregroundForHsl(ACCENT_HSL[k])).toBe(FOREGROUND_DARK);
  });
  it.each(['blue-600', 'indigo-600', 'emerald-700', 'red-600', 'slate-700', 'zinc-700', 'violet-500', 'blue-500', 'teal-600', 'lime-600'])('%s — white clears 3:1 and stays (a floor, not a flip to whichever is higher)', (k) => {
    expect(contrastRatio(ACCENT_HSL[k], FOREGROUND_LIGHT)!).toBeGreaterThanOrEqual(3);
    expect(foregroundForHsl(ACCENT_HSL[k])).toBe(FOREGROUND_LIGHT);
  });
  it('every accent in the table reaches at least 3:1 (large text / UI component minimum) with the text it is given', () => {
    for (const [k, hsl] of Object.entries(ACCENT_HSL)) {
      const fg = foregroundForHsl(hsl);
      expect([k, contrastRatio(hsl, fg)]).toEqual([k, expect.any(Number)]);
      expect(contrastRatio(hsl, fg)!).toBeGreaterThanOrEqual(3);
    }
  });
  it('luminance + contrast are the WCAG definitions', () => {
    expect(relativeLuminance('0 0% 100%')).toBeCloseTo(1, 5);
    expect(relativeLuminance('0 0% 0%')).toBeCloseTo(0, 5);
    expect(contrastRatio('0 0% 100%', '0 0% 0%')).toBeCloseTo(21, 3);
    expect(foregroundForHsl('garbage')).toBe(FOREGROUND_LIGHT);
  });
});
