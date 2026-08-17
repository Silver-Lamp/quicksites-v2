// app/garage-sales/__tests__/yardSaleSurface.test.ts
//
// The yardsalesites.com surfaces are LIGHT and carry a backdrop. Both properties are invisible
// to `tsc` and to every unit test that renders a component in isolation, and both fail silently:
//
//   - Theme: the app is wrapped in `<ThemeScope mode="dark">` (CLAUDE.md §7), so a page that
//     drops its light scope goes dark without erroring. Nothing throws; it just looks wrong to
//     whoever opens it, which on a public apex is a visitor rather than us.
//   - Backdrop: the layer sits at z-0 with content above it. An opaque page-level background on
//     the content side hides it completely — and a hidden backdrop is pixel-identical to a page
//     that never had one. That exact bug shipped on the main site renderer and survived weeks
//     (CLAUDE.md §5b), because its only symptom is the absence of decoration.
//
// ⚠️ Comments are stripped before matching. The source files below explain these rules in prose
// that names the very classes the rules forbid — without stripping, every assertion would pass
// on its own explanation. Same reason the sibling seller-path test does it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/** Source minus JSX block comments and line comments. */
const strip = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SURFACE = 'components/garage-sales/yard-sale-surface.tsx';

/** Every page that renders on yardsalesites.com. */
const PAGES = [
  'app/garage-sales/page.tsx',
  'app/s/[code]/page.tsx',
  'app/yard-sale/new/page.tsx',
];

describe('the yard-sale surface is light and backdropped', () => {
  it('scans a non-empty set of real files', () => {
    // A sweep that silently matches nothing reports success — the verify:assets lesson.
    expect(PAGES.length).toBeGreaterThan(0);
    for (const p of [...PAGES, SURFACE]) expect(read(p).length).toBeGreaterThan(0);
  });

  it('scopes itself to light rather than inheriting the dark app chrome', () => {
    expect(strip(read(SURFACE))).toMatch(/ThemeScope[\s\S]{0,80}mode="light"/);
  });

  it.each(PAGES)('%s renders inside the shared surface', (p) => {
    expect(strip(read(p))).toContain('<YardSaleSurface>');
  });
});

describe('nothing occludes the backdrop', () => {
  // The load-bearing one. `bg-background` is the correct token *for the surface* and the wrong
  // one for anything inside it, so this cannot be a blanket ban — it is specifically about the
  // pages, which are all children.
  it.each(PAGES)('%s does not paint its own page background', (p) => {
    expect(strip(read(p))).not.toMatch(/className="[^"]*\bbg-background\b/);
  });

  it('puts the backdrop under the content, not over it', () => {
    const s = strip(read(SURFACE));
    expect(s).toMatch(/absolute inset-0 z-0/); // the layer
    expect(s).toMatch(/relative z-10/);        // the content, above it
  });

  it('renders no layer at all when there is nothing to paint', () => {
    // Rule 7: degrade to plain. `backdropLayerStyle` returns null for style 'none', and the
    // wrapper must honour that by omitting the div rather than rendering an empty one.
    expect(strip(read(SURFACE))).toMatch(/\{layer &&/);
  });

  it('scrims the generated image so contrast is enforced, not hoped for', () => {
    expect(strip(read(SURFACE))).toMatch(/\{scrim &&/);
  });
});

describe('dark literals are confined to the deliberately-dark header', () => {
  // The shared SiteHeader is dark-only and `sticky` makes it translucent; over a light page its
  // own zinc-300 links land near 1.5:1. It is kept dark and made opaque instead of being edited,
  // because eleven other pages render it. So SOME zinc is correct here — but only there.
  it.each(PAGES)('%s uses zinc only for the header override', (p) => {
    const offenders = strip(read(p))
      .split('\n')
      .filter((l) => /\b(?:bg|text|border)-(?:zinc|slate|gray)-\d/.test(l))
      .filter((l) => !l.includes('HEADER_ON_LIGHT'));
    expect(offenders).toEqual([]);
  });

  it.each(PAGES)('%s never hard-codes an opaque white fill', (p) => {
    // `[^/-]` keeps this about OPAQUE fills — `bg-white/70` is a tint and is fine. A check that
    // fires on correct code trains you to ignore it (CLAUDE.md §7).
    expect(strip(read(p))).not.toMatch(/\bbg-white(\b[^/-]|$)/);
  });
});
