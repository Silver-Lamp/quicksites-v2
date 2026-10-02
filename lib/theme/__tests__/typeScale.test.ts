// lib/theme/__tests__/typeScale.test.ts

import fs from 'node:fs';
import path from 'node:path';
import { TYPE_SCALE, LEGACY_DISPLAY_MAX_PX, typeScaleFor, typeScaleVars } from '@/lib/theme/typeScale';
import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';
import { resolveSiteTheme } from '@/lib/theme/resolveSiteTheme';

/** Pull the three numbers out of `clamp(min, pref, max)` as rem/vw values. */
function parseClamp(v: string) {
  const m = v.match(/clamp\(\s*([\d.]+)rem\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)rem\s*\)/);
  if (!m) throw new Error(`not a rem/vw clamp: ${v}`);
  return { minPx: parseFloat(m[1]) * 16, vw: parseFloat(m[2]), maxPx: parseFloat(m[3]) * 16 };
}

describe('every mood has a scale, and all of them beat the old constant', () => {
  const moods = Object.keys(TYPE_SCALE) as Array<keyof typeof TYPE_SCALE>;

  it('covers every mood a pairing can declare', () => {
    // ⚠️ Derived from the pairings, never a second hand-kept list: a mood with no scale
    // would resolve to no vars and silently keep the 48px this exists to replace.
    const declared = new Set(Object.values(FONT_PAIRINGS).map((p) => p.mood));
    for (const m of declared) expect(TYPE_SCALE[m]).toBeDefined();
    expect(declared.size).toBeGreaterThan(1);
  });

  it.each(moods)('%s grows past the hard-coded 48px at desktop', (mood) => {
    expect(parseClamp(TYPE_SCALE[mood].display).maxPx).toBeGreaterThan(LEGACY_DISPLAY_MAX_PX);
  });

  it.each(moods)('%s barely moves on a phone', (mood) => {
    // The measured gap was a desktop gap. Doubling the mobile headline turns one wrapped
    // line into four — 30px is today's `text-3xl`, so stay within a size of it.
    const { minPx } = parseClamp(TYPE_SCALE[mood].display);
    expect(minPx).toBeGreaterThanOrEqual(30);
    expect(minPx).toBeLessThanOrEqual(36);
  });

  it('is fluid, never a fixed size', () => {
    for (const mood of moods) expect(TYPE_SCALE[mood].display).toMatch(/^clamp\(/);
  });

  it('gives editorial the largest display and technical the smallest', () => {
    const max = (m: keyof typeof TYPE_SCALE) => parseClamp(TYPE_SCALE[m].display).maxPx;
    expect(max('editorial')).toBe(Math.max(...moods.map(max)));
    expect(max('technical')).toBe(Math.min(...moods.map(max)));
  });

  it('tightens leading as the display grows', () => {
    // Large type at body leading reads as separate lines rather than one headline.
    expect(parseFloat(TYPE_SCALE.editorial.displayLeading))
      .toBeLessThan(parseFloat(TYPE_SCALE.technical.displayLeading));
  });
});

describe('an unthemed site is left exactly as it was', () => {
  it('emits nothing without a pairing', () => {
    expect(typeScaleFor(null)).toBeNull();
    expect(typeScaleFor('')).toBeNull();
    expect(typeScaleVars(undefined)).toEqual({});
  });

  it('emits nothing for a pairing id that no longer exists', () => {
    // A pairing renamed in code must not resolve to a broken var.
    expect(typeScaleFor('a-pairing-we-deleted')).toBeNull();
  });

  it('resolveSiteTheme adds no display vars when there is no pairing', () => {
    // ⚠️ A Tailwind TOKEN, not a hex — accentToHsl maps tokens and returns null for '#ff0000'.
    // My first draft of this test passed a hex, got null back, and would have "proved" the
    // absence of a var by accident while the theme never resolved at all.
    const t = { data: { meta: { theme: { accentColor: 'blue-600' } } } };
    const vars = resolveSiteTheme(t)?.vars ?? {};
    expect(vars['--primary']).toBeTruthy();
    expect(vars['--qs-display']).toBeUndefined();
  });

  it('keeps the typeface when the accent is unrecognised', () => {
    // 170 paired sites had no accent and no industry, so the whole theme was abandoned
    // before the font block and their stored pairing reached nothing.
    const t = { data: { meta: { theme: { fontPair: 'oswald-inter' } } } };
    const vars = resolveSiteTheme(t)?.vars ?? {};
    expect(vars['--font-heading']).toBeTruthy();
    expect(vars['--qs-display']).toBeTruthy();
    expect(vars['--primary']).toBeUndefined();
  });

  it('still returns null when there is no identity at all', () => {
    expect(resolveSiteTheme({ data: { meta: {} } })).toBeNull();
  });
});

describe('a themed site gets the scale through resolveSiteTheme', () => {
  const pair = Object.keys(FONT_PAIRINGS)[0];

  it('carries the display vars alongside the font vars', () => {
    const t = { data: { meta: { theme: { accentColor: 'blue-600', fontPair: pair } } } };
    const vars = resolveSiteTheme(t)?.vars ?? {};
    expect(vars['--font-heading']).toBeTruthy();
    expect(vars['--qs-display']).toBe(TYPE_SCALE[FONT_PAIRINGS[pair].mood].display);
    expect(vars['--qs-lead']).toBeTruthy();
  });
});

// ⚠️ SOURCE GUARDS. The three ways this ships looking correct and reaching nothing, each of
// which a unit test cannot see.
describe('the scale actually reaches a rendered page', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'styles/globals.css'), 'utf8');
  const hero = fs.readFileSync(
    path.join(process.cwd(), 'components/admin/templates/render-blocks/hero.tsx'),
    'utf8',
  );

  it('the CSS rule is scoped to themed sites only', () => {
    // Unscoped, it would resize the headline on every site including unthemed ones.
    expect(css).toMatch(/\[data-qs-themed\]\s*\[data-qs-display\]/);
  });

  it('applies the size in CSS, never as an inline style', () => {
    // ⚠️ An inline `font-size: var(--qs-display)` on a site with no pairing is invalid at
    // computed-value time → resolves to `unset` → the h1 INHERITS BODY SIZE rather than
    // falling back to its Tailwind class. Silent, fleet-wide, and looks like nothing happened.
    expect(hero).not.toMatch(/fontSize:\s*['"`]var\(--qs-display/);
  });

  it('the hero marks its headline and keeps the class fallback', () => {
    expect(hero).toMatch(/data-qs-display/);
    expect(hero).toMatch(/data-qs-lead/);
    // The Tailwind sizes are the fallback for unthemed sites, not dead code.
    expect(hero).toContain("'text-4xl md:text-5xl'");
  });

  it('does not apply a vw scale inside the narrow preview', () => {
    // A preview pane's viewport is the window's, so a thumbnail would get a page-sized headline.
    expect(hero).toMatch(/isNarrow \? \{\} : \{ 'data-qs-display'/);
  });

  it('is reading files that exist and are non-trivial', () => {
    expect(css.length).toBeGreaterThan(5000);
    expect(hero.length).toBeGreaterThan(5000);
  });
});

// ⚠️ THE REGRESSION THIS FILE EXISTS FOR, SECOND TIME. The first cut keyed the scale off the
// pairing's mood, which is tidy and wrong: most sites did not choose their pairing —
// `pickCuratedTheme` assigned one at creation and it knows nothing about mood. Measured on the
// owner's own target verticals AFTER it shipped: starter-photography carried `space-inter`
// (technical) and therefore got 56px, the ceiling meant for HVAC, on a photographer.
describe('the trade decides how loudly it may speak, not the typeface', () => {
  const px = (v: string) => parseFloat(v.match(/,\s*([\d.]+)rem\s*\)/)![1]) * 16;

  it.each(['photography', 'author', 'personal'])(
    '%s gets the editorial display even carrying a technical pairing',
    (industry) => {
      const scale = typeScaleFor('space-inter', industry)!; // space-inter is `technical`
      expect(scale.display).toBe(TYPE_SCALE.editorial.display);
    },
  );

  it('a trade keeps its own conservative ceiling', () => {
    // The inverse must hold too, or "industry wins" would just mean "everything is huge".
    const hvac = typeScaleFor('playfair-source', 'hvac')!; // playfair is `editorial`
    expect(hvac.display).toBe(TYPE_SCALE.technical.display);
    expect(px(hvac.display)).toBeLessThan(px(TYPE_SCALE.editorial.display));
  });

  it('falls back to the pairing when the site has no industry', () => {
    expect(typeScaleFor('playfair-source', null)!.display).toBe(TYPE_SCALE.editorial.display);
    expect(typeScaleFor('space-inter', '')!.display).toBe(TYPE_SCALE.technical.display);
  });

  it('an unmapped industry still resolves rather than losing the scale', () => {
    expect(typeScaleFor('space-inter', 'something-we-never-added')).not.toBeNull();
  });

  it('resolveSiteTheme passes the industry through', () => {
    const t = { data: { meta: { industry: 'photography', theme: { fontPair: 'space-inter' } } } };
    expect(resolveSiteTheme(t)?.vars['--qs-display']).toBe(TYPE_SCALE.editorial.display);
  });
});
