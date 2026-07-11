// lib/theme/shuffleOptions.ts
//
// Pure random-pick helpers for the editor's Shuffle menu. Each axis draws from the
// same catalogs the theme system already uses (accents, font pairings, layout), and
// every pick avoids the current value so a shuffle visibly changes something. None of
// these touch copy/content — only style/layout fields under data.meta.theme or a
// block's style field.

import { ACCENT_HSL } from '@/lib/theme/accentHsl';
import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';

const ACCENTS = Object.keys(ACCENT_HSL);
const FONT_PAIR_IDS = Object.keys(FONT_PAIRINGS);

export const RHYTHMS = ['plain', 'banded'] as const;
export const HERO_MODES = ['inline', 'full_bleed', 'background'] as const;
export const FEATURE_VARIANTS = ['grid', 'cards', 'rows'] as const;

/** Pick a random element of `pool`, avoiding `avoid` when the pool has alternatives. */
export function pickDistinct<T>(pool: readonly T[], avoid?: T | null, rng: () => number = Math.random): T {
  if (pool.length === 0) throw new Error('pickDistinct: empty pool');
  if (pool.length === 1) return pool[0];
  const choices = avoid == null ? pool : pool.filter((x) => x !== avoid);
  const from = choices.length ? choices : pool;
  return from[Math.floor(rng() * from.length)];
}

/** A fresh accent pair (primary + secondary), both different from the current primary. */
export function pickAccentPair(
  avoid?: string | null,
  rng: () => number = Math.random,
): { accentColor: string; accent2Color: string } {
  const accentColor = pickDistinct(ACCENTS, avoid, rng);
  const accent2Color = pickDistinct(ACCENTS, accentColor, rng);
  return { accentColor, accent2Color };
}

export function pickFontPair(avoid?: string | null, rng: () => number = Math.random): string {
  return pickDistinct(FONT_PAIR_IDS, avoid, rng);
}

/** Map a theme's heroLayout onto the render-wired hero block layout_mode. */
export function heroModeFromLayout(heroLayout?: string | null): (typeof HERO_MODES)[number] {
  if (heroLayout === 'full_bleed') return 'full_bleed';
  if (heroLayout === 'split') return 'background';
  return 'inline';
}
