// lib/theme/__tests__/shuffleTemplate.test.ts
//
// The "Shuffle everything" transform is shared by the editor toolbar and the
// standalone /preview page. Load-bearing property: it restyles (theme + hero/
// services layout + color mode) WITHOUT touching any copy/content.

import { shuffleAllData, withBlockStyles } from '@/lib/theme/shuffleTemplate';
import { CURATED_THEMES, toStampedTheme } from '@/lib/theme/curatedThemes';

describe('withBlockStyles', () => {
  const data = {
    pages: [
      {
        slug: 'home',
        blocks: [
          { type: 'hero', content: { heading: 'Welcome', layout_mode: 'inline' } },
          { type: 'services', content: { title: 'What we do', variant: 'grid' } },
          { type: 'faq', content: { title: 'FAQ' } },
        ],
      },
    ],
  };

  it('sets the field on matching block types and leaves others (and copy) untouched', () => {
    const out = withBlockStyles(data, [
      { type: 'hero', field: 'layout_mode', value: 'full_bleed' },
      { type: 'services', field: 'variant', value: 'cards' },
    ]);
    const blocks = out.pages[0].blocks;
    expect(blocks[0].content.layout_mode).toBe('full_bleed');
    expect(blocks[0].content.heading).toBe('Welcome'); // copy preserved
    expect(blocks[1].content.variant).toBe('cards');
    expect(blocks[1].content.title).toBe('What we do'); // copy preserved
    expect(blocks[2].content).toEqual({ title: 'FAQ' }); // untouched type
  });

  it('recurses into nested blocks', () => {
    const nested = { pages: [{ slug: 'home', blocks: [{ type: 'section', blocks: [{ type: 'hero', content: {} }] }] }] };
    const out = withBlockStyles(nested, [{ type: 'hero', field: 'layout_mode', value: 'background' }]);
    expect(out.pages[0].blocks[0].blocks[0].content.layout_mode).toBe('background');
  });

  it('is immutable — does not mutate the input', () => {
    const before = JSON.parse(JSON.stringify(data));
    withBlockStyles(data, [{ type: 'hero', field: 'layout_mode', value: 'full_bleed' }]);
    expect(data).toEqual(before);
  });
});

describe('shuffleAllData', () => {
  const theme = CURATED_THEMES[0];
  const stamped = toStampedTheme(theme);

  const data = {
    color_mode: 'light',
    meta: { industry: 'towing', theme: { id: 'other-theme', accentColor: 'slate-500' } },
    pages: [
      {
        slug: 'home',
        blocks: [
          { type: 'hero', content: { heading: 'Ray’s Towing', layout_mode: 'inline' } },
          { type: 'services', content: { title: 'Services', variant: 'grid' } },
        ],
      },
    ],
  };

  it('stamps the picked theme + color mode and restyles hero/services (deterministic via opts.theme)', () => {
    const { data: out, colorMode, themeName } = shuffleAllData(data, { theme });
    expect(out.meta.theme).toEqual(stamped);
    expect(colorMode).toBe(theme.darkMode);
    expect(out.color_mode).toBe(theme.darkMode);
    expect(themeName).toBe(theme.name);
    // hero + services layout reflect the theme's layout personality
    expect(out.pages[0].blocks[0].content.layout_mode).toBeTruthy();
    expect(out.pages[0].blocks[1].content.variant).toBe(stamped.layout?.featureVariant ?? 'grid');
  });

  it('never touches copy or the industry', () => {
    const { data: out } = shuffleAllData(data, { theme });
    expect(out.pages[0].blocks[0].content.heading).toBe('Ray’s Towing');
    expect(out.pages[0].blocks[1].content.title).toBe('Services');
    expect(out.meta.industry).toBe('towing');
  });

  it('picks a real theme (and avoids the current) when none is injected', () => {
    const { data: out, colorMode } = shuffleAllData(data);
    expect(out.meta.theme?.accentColor).toBeTruthy();
    expect(out.meta.theme?.id).not.toBe('other-theme');
    expect(['light', 'dark']).toContain(colorMode);
  });

  it('tolerates empty/missing data', () => {
    const { data: out, colorMode } = shuffleAllData({}, { theme });
    expect(out.meta.theme).toEqual(stamped);
    expect(['light', 'dark']).toContain(colorMode);
  });
});
