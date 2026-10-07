/**
 * @jest-environment node
 */
// components/home/__tests__/siteFlyThrough.test.ts
//
// The showcase fly-through behind the hero: five real sites scale up from the vanishing point and
// fade out as they get large. Guards pin the properties that keep it cheap, honest and harmless.
import fs from 'node:fs';
import path from 'node:path';
import { FLY_COUNT, FLY_LANES } from '@/lib/home/flyThrough';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('lanes', () => {
  it('has one lane per card, each drifting outward with a distinct duration', () => {
    expect(FLY_COUNT).toBe(5);
    expect(FLY_LANES.length).toBe(FLY_COUNT);
    for (const l of FLY_LANES) {
      expect(Math.abs(l.x1) + Math.abs(l.y1)).toBeGreaterThanOrEqual(Math.abs(l.x0) + Math.abs(l.y0));
      expect(l.seconds).toBeGreaterThan(10);
    }
    expect(new Set(FLY_LANES.map((l) => l.seconds)).size).toBe(FLY_COUNT);
  });
});

describe('the component', () => {
  const src = strip(read('components/home/site-fly-through.tsx'));

  it('grows toward the viewer and fades out at the end — never ends opaque and huge', () => {
    expect(src).toMatch(/0%\s*\{[^}]*scale\(0\.12\);\s*opacity:\s*0;/);
    expect(src).toMatch(/100%\s*\{[^}]*scale\(1\.9\);\s*opacity:\s*0;/);
  });

  it('is decoration: aria-hidden and never a click target', () => {
    expect(src).toMatch(/aria-hidden/);
    expect(src).toMatch(/pointer-events-none/);
    expect(src).not.toMatch(/<a\s|<Link/);
  });

  it('honours prefers-reduced-motion', () => {
    expect(src).toMatch(/prefers-reduced-motion: reduce/);
    expect(src).toMatch(/animation: none/);
  });

  it('animates transform and opacity only (compositor work, no layout)', () => {
    const kf = src.slice(src.indexOf('@keyframes qs-fly'), src.indexOf('.qs-fly-card {'));
    expect(kf).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:/);
  });

  it('uses the showcase thumbnail endpoint, so a site with no hero still renders', () => {
    expect(src).toMatch(/\/api\/public\/showcase\/\$\{encodeURIComponent\(s\.slug\)\}\/thumb/);
  });
});

describe('the wiring', () => {
  // ⚠️ THE BUG THAT SHIPPED FIRST. app/page.tsx (server) imported FLY_COUNT from the 'use client'
  // component; across that boundary a value export is a client-reference proxy, so
  // slice(0, FLY_COUNT) was slice(0, NaN) → [] → the layer rendered nothing in production while
  // every test passed. Values shared by both sides live in a plain module.
  it('the server page never imports a VALUE from the client component', () => {
    const page = strip(read('app/page.tsx'));
    expect(page).not.toMatch(/import\s+\w+\s*,\s*\{[^}]*\}\s*from\s*'@\/components\/home\/site-fly-through'/);
    expect(page).not.toMatch(/import\s*\{[^}]*\}\s*from\s*'@\/components\/home\/site-fly-through'/);
    expect(page).toMatch(/import \{ FLY_COUNT \} from '@\/lib\/home\/flyThrough'/);
    // Comments stripped first: the lib's own header explains the 'use client' trap, and a
    // mentions-it check would fail on the explanation (the ROUTER_STRATEGY lesson, CLAUDE.md §4).
    const lib = strip(read('lib/home/flyThrough.ts'));
    expect(lib).not.toMatch(/['"]use client['"]/);
    const comp = strip(read('components/home/site-fly-through.tsx'));
    expect(comp).not.toMatch(/export const FLY_COUNT/);
  });

  it('the page memoises the showcase read and passes the first five visible sites', () => {
    const page = strip(read('app/page.tsx'));
    expect(page).toMatch(/const showcaseOnce = cache\(getShowcaseData\)/);
    expect(page).toMatch(/filter\(\(s\) => !s\.hidden\)\.slice\(0, FLY_COUNT\)/);
    expect(page).not.toMatch(/await getShowcaseData\(\)/); // both consumers go through the cache
  });

  it('the headline and subhead sit on a scrim above the fly-through', () => {
    // Owner, 2026-10-06: the sites coming in made the text hard to read. The text block isolates
    // its own stacking context and carries a radial shade behind the words.
    const home = strip(read('components/home/home-client.tsx'));
    const scrimAt = home.indexOf('data-qs-hero-scrim');
    const h1At = home.indexOf('<motion.h1', scrimAt);
    const subheadEnd = home.indexOf('heroSubhead}', scrimAt);
    const closeAt = home.indexOf('</div>', subheadEnd);
    expect(scrimAt).toBeGreaterThan(0);
    expect(h1At).toBeGreaterThan(scrimAt);
    const block = home.slice(scrimAt - 80, scrimAt + 400);
    expect(block).toMatch(/relative isolate/);
    expect(block).toMatch(/radial-gradient/);
    expect(block).toMatch(/-z-10/);
    expect(closeAt).toBeGreaterThan(subheadEnd); // the wrapper closes after the subhead
  });

  it('the hero renders the layer behind the headline, default brand only', () => {
    const home = strip(read('components/home/home-client.tsx'));
    const main = home.indexOf('<main id="start"');
    const layer = home.indexOf('{showCharacter && heroLayer}');
    const headline = home.indexOf('<div className="flex items-center gap-3">', main);
    expect(main).toBeGreaterThan(0);
    expect(layer).toBeGreaterThan(main);
    expect(layer).toBeLessThan(headline);
  });
});
