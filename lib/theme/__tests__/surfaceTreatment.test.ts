// lib/theme/__tests__/surfaceTreatment.test.ts

import fs from 'node:fs';
import path from 'node:path';
import { WOBBLE_RADII, surfaceVars, surfaceAttr, isSurfaceTreatment } from '@/lib/theme/surfaceTreatment';
import { resolveSiteTheme } from '@/lib/theme/resolveSiteTheme';
import { CURATED_THEMES } from '@/lib/theme/curatedThemes';
import { FONT_PAIRINGS } from '@/lib/theme/fontPairings';
import { TYPE_SCALE } from '@/lib/theme/typeScale';

describe('only the sticker treatment draws anything', () => {
  it.each(['flat', 'soft', 'glow'])('%s emits no vars and no attribute', (s) => {
    // ⚠️ The existing fleet must be byte-identical. Every curated theme already declares a
    // `surface`, and until now nothing read it — so emitting anything for the other three
    // would silently restyle ~20 themes' worth of live sites.
    expect(surfaceVars(s)).toEqual({});
    expect(surfaceAttr(s)).toBeUndefined();
  });

  it('an unknown or missing surface emits nothing', () => {
    expect(surfaceVars(undefined)).toEqual({});
    expect(surfaceVars('neon-chrome')).toEqual({});
    expect(isSurfaceTreatment('neon-chrome')).toBe(false);
  });

  it('sticker emits ink, an unblurred shadow and every wobble', () => {
    const v = surfaceVars('sticker');
    expect(v['--qs-surface-ink']).toBeTruthy();
    expect(surfaceAttr('sticker')).toBe('sticker');
    WOBBLE_RADII.forEach((r, i) => expect(v[`--qs-wobble-${i + 1}`]).toBe(r));
  });

  it('the shadow has ZERO blur', () => {
    // A blurred shadow reads as depth; an un-blurred one reads as a sticker on the page.
    // `Xpx Ypx 0 colour` — the third length is the blur radius and it must be 0.
    expect(surfaceVars('sticker')['--qs-surface-shadow']).toMatch(/^-?\d+px -?\d+px 0 /);
  });
});

describe('the wobble actually wobbles', () => {
  it('every corner of every radius differs from the uniform case', () => {
    // ⚠️ A single irregular radius repeated everywhere is just a different machine shape.
    for (const r of WOBBLE_RADII) {
      const corners = r.split(/\s+/);
      expect(corners).toHaveLength(4);
      expect(new Set(corners).size).toBeGreaterThan(2);
    }
  });

  it('no two sets are the same', () => {
    expect(new Set(WOBBLE_RADII).size).toBe(WOBBLE_RADII.length);
  });

  it('the cycle length does not line up with common grid widths', () => {
    // At 5, a 2/3/4-column grid never repeats a radius down a column.
    for (const cols of [2, 3, 4]) expect(WOBBLE_RADII.length % cols).not.toBe(0);
  });
});

describe('the toon theme is wired end to end', () => {
  const toon = CURATED_THEMES.filter((t) => t.surface === 'sticker');

  it('ships at least one theme that uses it', () => {
    expect(toon.length).toBeGreaterThan(0);
  });

  it('every sticker theme uses a toon pairing', () => {
    for (const t of toon) expect(FONT_PAIRINGS[t.fontPair]?.mood).toBe('toon');
  });

  it('the toon mood has a display scale', () => {
    // Guarded again here because adding a mood without a scale resolves to NO display size.
    expect(TYPE_SCALE.toon).toBeDefined();
  });

  it('Knewave requests only the one weight it ships', () => {
    // ⚠️ A brush face has its weight drawn in. Requesting 700 returns the 400 face, so the
    // heading renders light where the designer expected bold — and nothing reports it.
    expect(FONT_PAIRINGS['knewave-nunito'].heading.weights).toEqual([400]);
  });

  it('resolveSiteTheme carries the surface onto a real theme bag', () => {
    const t = {
      data: { meta: { theme: { accentColor: 'cyan-600', fontPair: 'knewave-nunito', surface: 'sticker' } } },
    };
    const r = resolveSiteTheme(t)!;
    expect(r.surface).toBe('sticker');
    expect(r.vars['--qs-surface-shadow']).toBeTruthy();
    expect(r.vars['--qs-wobble-3']).toBeTruthy();
  });

  it('a flat theme carries no surface', () => {
    const t = { data: { meta: { theme: { accentColor: 'cyan-600', surface: 'flat' } } } };
    expect(resolveSiteTheme(t)?.surface).toBeUndefined();
  });
});

// ⚠️ SOURCE GUARDS — the ways this ships looking right and reaching nothing.
describe('the treatment reaches a rendered page', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'styles/globals.css'), 'utf8');
  const wrapper = fs.readFileSync(
    path.join(process.cwd(), 'components/theme/template-theme-wrapper.tsx'),
    'utf8',
  );

  it('the wrapper emits data-qs-surface', () => {
    expect(wrapper).toMatch(/data-qs-surface=\{resolved\?\.surface\}/);
  });

  it('the CSS is scoped so no other site matches it', () => {
    expect(css).toMatch(/\[data-qs-surface='sticker'\]/);
    // Never a bare rule that would hit every site.
    expect(css).not.toMatch(/^\s*\.bg-card\s*\{[^}]*border:\s*var\(--qs-surface-ink/m);
  });

  it('cycles every wobble var in CSS, not just the first', () => {
    // Defining five and using one is the repeat-pattern bug with extra steps.
    for (let i = 1; i <= WOBBLE_RADII.length; i++) {
      expect(css).toContain(`var(--qs-wobble-${i})`);
    }
  });

  it('the press animation honours reduced motion', () => {
    const idx = css.indexOf("[data-qs-surface='sticker'] :is(button");
    const before = css.slice(0, css.indexOf(':active', idx));
    expect(before).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });

  it('is reading files that exist and are non-trivial', () => {
    expect(css.length).toBeGreaterThan(5000);
    expect(wrapper.length).toBeGreaterThan(2000);
  });
});
