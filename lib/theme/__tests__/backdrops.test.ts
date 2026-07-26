// Locks in the two properties of the backdrop layer that are easy to break silently and
// invisible to `tsc`: (1) painterly-backdrop standard rule 7 — with nothing configured, or
// a painterly style whose image hasn't been generated, the site must render EXACTLY as it
// did before (no layer at all, never an empty box); (2) every CSS style is expressed in
// theme vars, so a backdrop follows the site's accent and stays legible in light AND dark.
//
// That second one is the CLAUDE.md §7 trap: a hardcoded color here would look fine in the
// editor and wrong on half the live sites, and no type error would ever fire.

import {
  BACKDROP_STYLES,
  backdropLayerStyle,
  backdropScrimStyle,
  defaultBackdropFor,
  readBackdrop,
  type BackdropStyle,
} from '@/lib/theme/backdrops';

const CSS_STYLES = BACKDROP_STYLES.filter((s) => s !== 'none' && s !== 'painterly');

describe('backdrop layer — degrades to plain (standard rule 7)', () => {
  it('renders no layer when nothing is configured', () => {
    expect(backdropLayerStyle(null)).toBeNull();
  });

  it('renders no layer for style "none"', () => {
    expect(backdropLayerStyle({ style: 'none' })).toBeNull();
  });

  it('renders no layer at zero intensity', () => {
    expect(backdropLayerStyle({ style: 'wash', intensity: 0 })).toBeNull();
  });

  it('renders no layer for painterly with no image yet — never an empty box', () => {
    expect(backdropLayerStyle({ style: 'painterly' })).toBeNull();
    expect(backdropLayerStyle({ style: 'painterly', url: null })).toBeNull();
  });
});

describe('contrast scrim (standard rule 8)', () => {
  it('is applied over a generated image, whose contents we do not control', () => {
    expect(backdropScrimStyle({ style: 'painterly', url: 'https://x/y.png?v=1' })).not.toBeNull();
  });

  it('is not applied to CSS styles, which already composite over --background', () => {
    for (const style of CSS_STYLES) {
      expect(backdropScrimStyle({ style: style as BackdropStyle, intensity: 50 })).toBeNull();
    }
  });
});

describe('CSS styles follow the site theme', () => {
  it.each(CSS_STYLES)('%s emits a background built from theme vars', (style) => {
    const out = backdropLayerStyle({ style: style as BackdropStyle, intensity: 50 });
    const bg = String((out as any)?.backgroundImage ?? '');
    expect(bg).toBeTruthy();
    expect(bg).toMatch(/var\(--(primary|foreground)\)/);
  });

  it.each(CSS_STYLES)('%s hardcodes no color (would break light/dark)', (style) => {
    const out = backdropLayerStyle({ style: style as BackdropStyle, intensity: 50 });
    const bg = String((out as any)?.backgroundImage ?? '');
    expect(bg).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(bg).not.toMatch(/\brgba?\(/i);
  });

  it('scales with intensity', () => {
    const lo = backdropLayerStyle({ style: 'wash', intensity: 10 });
    const hi = backdropLayerStyle({ style: 'wash', intensity: 90 });
    expect((lo as any).backgroundImage).not.toEqual((hi as any).backgroundImage);
  });
});

describe('defaults — a new site is never flat', () => {
  it.each(['personal', 'restaurant', 'deck_builder', 'plumbing', 'legal', 'not_a_real_industry'])(
    '%s gets a real backdrop',
    (key) => {
      expect(defaultBackdropFor(key).style).not.toBe('none');
    },
  );

  it('falls back to a real style with no industry at all', () => {
    expect(defaultBackdropFor(null).style).not.toBe('none');
    expect(defaultBackdropFor(undefined).style).not.toBe('none');
  });

  it('marks the default as auto so a fleet upgrade can tell it from an owner pick', () => {
    expect(defaultBackdropFor('restaurant').auto).toBe(true);
  });
});

describe('readBackdrop tolerates junk', () => {
  it('returns null for an empty or malformed template', () => {
    expect(readBackdrop({})).toBeNull();
    expect(readBackdrop({ data: { meta: {} } })).toBeNull();
    expect(readBackdrop({ data: { meta: { backdrop: 'wash' } } })).toBeNull();
    expect(readBackdrop({ data: { meta: { backdrop: { style: 'nope' } } } })).toBeNull();
  });

  it('parses a valid backdrop and clamps intensity', () => {
    expect(readBackdrop({ data: { meta: { backdrop: { style: 'mesh' } } } })?.style).toBe('mesh');
    expect(readBackdrop({ data: { meta: { backdrop: { style: 'mesh', intensity: 999 } } } })?.intensity).toBe(100);
    expect(readBackdrop({ data: { meta: { backdrop: { style: 'mesh', intensity: -5 } } } })?.intensity).toBe(0);
  });
});
