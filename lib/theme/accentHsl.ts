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

/** Pick a readable foreground (near-black on light accents, white on dark). */
export function foregroundForHsl(hsl: string): string {
  const parts = hsl.split(/\s+/);
  const l = parseFloat((parts[2] || '').replace('%', ''));
  return Number.isFinite(l) && l >= 62 ? '222 47% 11%' : '0 0% 100%';
}
