// lib/theme/surfaceTreatment.ts
//
// How a theme's surfaces are drawn: flat, soft, glow — or `sticker`, the hand-drawn one.
//
// ⚠️ `surface` HAS BEEN ON EVERY CURATED THEME SINCE PHASE B AND CONSUMED BY NOTHING. Declared
// on all 20-odd themes, typed, documented in THEME_SYSTEM_PLAN.md, read by zero code. The
// fourth built-and-unreachable system found in this repo in a week (the others: the gallery
// block, the font pairings, `themeId`). Checked with a grep before adding to it, which is the
// rule now: before building a theme axis, see whether the axis already exists and is idle.
//
// ── The `sticker` treatment ──────────────────────────────────────────────────────────────
// Reference: pressbox.studio (read 2026-10-02). Its signature is four things, and only the
// first is a font:
//
//   1. Knewave for display — a brush/marker face, loaded `display=block` so it never flashes
//      a system fallback. On a toon design the fallback IS the broken state.
//   2. Hard offset shadows with ZERO blur — `3px 3px 0 rgba(0,0,0,.25)`. A blurred shadow
//      reads as depth; an un-blurred one reads as a sticker lying on the page. This is the
//      single cheapest part of the look and the one most often got wrong.
//   3. IRREGULAR border-radius — `8px 12px 10px 6px`, a different value per corner. This is
//      the actual trick. A uniform radius always reads as machine-drawn no matter how round
//      it is; four mismatched corners read as drawn by a hand.
//   4. Saturated colour over black ink outlines.
//
// ⚠️ THE WOBBLE MUST VARY BETWEEN ELEMENTS OR IT IS NOT WOBBLE. One irregular radius applied
// everywhere is just a different machine shape — the eye locks onto the repeat immediately.
// So this exports a SET and the CSS cycles it with `:nth-of-type`, which costs no JavaScript
// and survives SSR. Prime-ish cycle length (5) against typical grid widths (2, 3, 4) so the
// pattern does not line up into columns.
//
// ⚠️ Aesthetics are not ownable and a brush font on a bright palette is a genre, not a
// property. What would not be fine is reproducing someone's actual layout, copy or artwork —
// none of which is here. This is a genre entry, the way `ironworks` is a rugged one.

export type SurfaceTreatment = 'flat' | 'soft' | 'glow' | 'sticker';

/**
 * Five hand-drawn corner sets, cycled per element.
 *
 * Kept deliberately small and asymmetric: each has one near-square corner and one generous
 * one, which is what stops a row of cards reading as a row of identical blobs.
 */
export const WOBBLE_RADII = [
  '14px 22px 16px 10px',
  '20px 10px 24px 14px',
  '10px 18px 12px 24px',
  '24px 14px 10px 20px',
  '16px 24px 20px 12px',
] as const;

export type SurfaceVars = {
  /** Offset shadow, zero blur. Empty string for treatments that do not draw one. */
  shadow: string;
  /** Ink outline width, e.g. `2px`. Empty string for none. */
  inkWidth: string;
};

const SURFACE_VARS: Record<SurfaceTreatment, SurfaceVars> = {
  flat: { shadow: '', inkWidth: '' },
  soft: { shadow: '', inkWidth: '' },
  glow: { shadow: '', inkWidth: '' },
  // ⚠️ The ink is `currentColor`-independent black on purpose: a toon outline is INK, not a
  // tint of the accent. Tinted outlines are what make a bright palette read as muddy.
  sticker: { shadow: '3px 3px 0 rgba(0,0,0,0.85)', inkWidth: '2px' },
};

export function isSurfaceTreatment(v: unknown): v is SurfaceTreatment {
  return v === 'flat' || v === 'soft' || v === 'glow' || v === 'sticker';
}

/**
 * CSS custom properties for a surface treatment.
 *
 * ⚠️ Returns `{}` for anything that draws nothing, so the wrapper emits no vars and no
 * `data-qs-surface` — a site on a flat theme is byte-identical to before this existed. Same
 * rule-7 shape as the backdrop and the type scale: the absent case is the plain page.
 */
export function surfaceVars(surface: unknown): Record<string, string> {
  if (!isSurfaceTreatment(surface)) return {};
  const v = SURFACE_VARS[surface];
  if (!v.shadow && !v.inkWidth) return {};
  const out: Record<string, string> = {
    '--qs-surface-shadow': v.shadow,
    '--qs-surface-ink': v.inkWidth,
  };
  WOBBLE_RADII.forEach((r, i) => { out[`--qs-wobble-${i + 1}`] = r; });
  return out;
}

/** The value for the wrapper's `data-qs-surface`, or undefined when nothing is drawn. */
export function surfaceAttr(surface: unknown): string | undefined {
  if (!isSurfaceTreatment(surface)) return undefined;
  const v = SURFACE_VARS[surface];
  return v.shadow || v.inkWidth ? surface : undefined;
}
