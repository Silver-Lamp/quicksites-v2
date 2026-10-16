// lib/theme/accentHsl.ts
//
// Maps the Tailwind accent tokens used by industryPresets to HSL triples in the
// "H S% L%" form the shadcn CSS vars expect (e.g. `--primary: 199 89% 55%`), so
// a site's accent can be scoped onto --primary/--ring at render time.

export const ACCENT_HSL: Record<string, string> = {
  'amber-500': '38 92% 50%',
  'amber-600': '32 95% 44%',
  'amber-700': '26 90% 37%',
  'amber-800': '23 83% 31%',
  'yellow-500': '45 93% 47%',
  'orange-500': '25 95% 53%',
  'red-600': '0 72% 51%',
  'rose-500': '350 89% 60%',
  'rose-600': '347 77% 50%',
  'pink-400': '329 86% 70%',
  'pink-500': '330 81% 60%',
  'fuchsia-500': '292 84% 61%',
  'fuchsia-600': '293 69% 49%',
  'purple-500': '271 91% 65%',
  'violet-500': '258 90% 66%',
  'indigo-500': '239 84% 67%',
  'indigo-600': '243 75% 59%',
  'blue-500': '217 91% 60%',
  'blue-600': '221 83% 53%',
  'sky-500': '199 89% 48%',
  'cyan-600': '192 91% 36%',
  'teal-500': '173 80% 40%',
  'teal-600': '175 84% 32%',
  'emerald-600': '161 94% 30%',
  'emerald-700': '163 94% 24%',
  'green-600': '142 76% 36%',
  'lime-500': '84 81% 44%',
  'lime-600': '86 78% 35%',
  'slate-700': '215 25% 27%',
  'gray-700': '217 19% 27%',
  'zinc-300': '240 5% 84%',
  'zinc-700': '240 5% 26%',
};

/** Tailwind accent token → "H S% L%", or null if unknown. */
export function accentToHsl(token?: string | null): string | null {
  if (!token) return null;
  return ACCENT_HSL[token.trim().toLowerCase()] ?? null;
}

/** "H S% L%" → sRGB in 0..1. */
export function hslTripleToRgb(hsl: string): [number, number, number] | null {
  const parts = hsl.trim().split(/\s+/);
  const h = parseFloat(parts[0] ?? '');
  const s = parseFloat((parts[1] ?? '').replace('%', '')) / 100;
  const l = parseFloat((parts[2] ?? '').replace('%', '')) / 100;
  if (![h, s, l].every(Number.isFinite)) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r1 + m, g1 + m, b1 + m];
}

/** WCAG relative luminance of "H S% L%". */
export function relativeLuminance(hsl: string): number | null {
  const rgb = hslTripleToRgb(hsl);
  if (!rgb) return null;
  const lin = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two "H S% L%" colours (1..21), or null when unparseable. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const FOREGROUND_DARK = '222 47% 11%';
export const FOREGROUND_LIGHT = '0 0% 100%';

/** WCAG 1.4.11 non-text / UI-component minimum. Button text is at least this, or it flips. */
export const MIN_BUTTON_CONTRAST = 3;

/**
 * Pick a readable foreground for an accent: white, unless white fails the 3:1 UI-component
 * floor against it and near-black does better.
 *
 * ⚠️ This used to test HSL LIGHTNESS (`l >= 62 → dark text`), which is not how eyes work:
 * `lime-500` is `84 81% 44%` — L 44, so it got WHITE text — and white on that lime measures
 * **2.0:1**. Measured by the UX scan of the B Hard site (2026-10-16) on its hero CTA and Submit
 * button; the same pair sat on every Citrus-themed site. Near-black on it is 9:1. Yellow, amber,
 * orange, sky, teal-500 and pink-400 have the same shape: a mid lightness and a high luminance.
 *
 * Why a FLOOR and not "whichever is higher": the table has a dozen mid accents where white sits
 * at 3.4–4.4 and dark at 4.0–5.3 (blue-500, rose-500, teal-600, emerald-600 …). Flipping those
 * to dark text would recolour the buttons on a large share of the fleet for a marginal gain;
 * white above 3:1 is the conventional, legible choice. Only the genuine failures change.
 */
export function foregroundForHsl(hsl: string): string {
  const dark = contrastRatio(hsl, FOREGROUND_DARK);
  const light = contrastRatio(hsl, FOREGROUND_LIGHT);
  if (dark == null || light == null) return FOREGROUND_LIGHT;
  if (light >= MIN_BUTTON_CONTRAST) return FOREGROUND_LIGHT;
  return dark > light ? FOREGROUND_DARK : FOREGROUND_LIGHT;
}
