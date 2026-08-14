// components/sites/__tests__/siteSurfacePaint.test.ts
//
// ⚠️ EXACTLY ONE ELEMENT MAY PAINT THE SITE SURFACE, AND IT HAS TO BE THE OUTERMOST ONE.
//
// `TemplateThemeWrapper` renders the site's backdrop (lib/theme/backdrops.ts) as an absolutely
// positioned layer at z-index 0, with the page content above it at z-index 1. So ANY opaque
// `--background` fill on the content side covers the backdrop completely — the layer still
// renders, still costs its CSS, and never reaches a pixel.
//
// That is what shipped: `SiteRenderer` applied `bg-background`, and BOTH public page routes
// passed `className="bg-background text-foreground"` in on top of it, so the served markup read
//
//     class="… bg-background text-foreground bg-background text-foreground"
//
// and every site with a backdrop had an invisible one. Nothing failed. The page looked fine —
// it just looked like a site with no backdrop, which is a perfectly normal thing for a page to
// look like. That is why this is a test and not a comment: the symptom of the bug is the
// absence of decoration, and absence is not something anyone notices in review.
//
// The fix moved the paint up to the wrapper. This test stops it drifting back down, which is a
// one-word edit that looks like an obvious improvement ("the renderer should paint its own
// background") from anywhere except here.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

/** Every .tsx under the given dirs, minus build output. */
function tsxFiles(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.tsx')) out.push(full);
    }
  };
  for (const d of dirs) walk(path.join(ROOT, d));
  return out;
}

/** The text of each `<SiteRenderer … />` element in a file. */
function siteRendererElements(src: string): string[] {
  const els: string[] = [];
  let i = src.indexOf('<SiteRenderer');
  while (i !== -1) {
    const end = src.indexOf('/>', i);
    if (end === -1) break;
    els.push(src.slice(i, end + 2));
    i = src.indexOf('<SiteRenderer', end);
  }
  return els;
}

describe('the site surface is painted in exactly one place', () => {
  const files = tsxFiles(['app', 'components']);

  it('scans a non-empty set of files', () => {
    // A sweep that matches nothing passes every assertion below and reports success — the same
    // silence-looks-like-success failure the rule itself is about.
    expect(files.length).toBeGreaterThan(100);
  });

  const callers = files.filter((f) => siteRendererElements(fs.readFileSync(f, 'utf8')).length > 0);

  it('finds the SiteRenderer call sites', () => {
    expect(callers.length).toBeGreaterThan(0);
  });

  it.each(callers.length ? callers : ['<none>'])(
    'no SiteRenderer call site passes a background fill: %s',
    (file) => {
      if (file === '<none>') return;
      for (const el of siteRendererElements(fs.readFileSync(file, 'utf8'))) {
        // Strip comments — the call sites explain the rule in prose that names the class.
        const code = el.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/className=\{?["'`][^"'`]*\bbg-(background|white|black|card)\b/);
      }
    }
  );

  it('SiteRenderer only paints a surface when no theme wrapper is above it', () => {
    const src = fs.readFileSync(path.join(ROOT, 'components/sites/site-renderer.tsx'), 'utf8');
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Present, but guarded on the wrapper being disabled.
    expect(code).toMatch(/bg-background/);
    expect(code).toMatch(/!enableThemeWrapper\s*&&\s*'bg-background'/);
  });

  it('the theme wrapper paints the surface below the backdrop layers', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'components/theme/template-theme-wrapper.tsx'),
      'utf8'
    );
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).toMatch(/background:\s*'hsl\(var\(--background\)\)'/);
  });
});
