// lib/gallery/__tests__/galleryData.test.ts

import fs from 'node:fs';
import path from 'node:path';
import { CREATIVE_INDUSTRIES, PER_INDUSTRY } from '@/lib/gallery/getGalleryData';
import { INDUSTRIES } from '@/lib/industries';

const LIB = path.join(process.cwd(), 'lib/gallery/getGalleryData.ts');
const PAGE = path.join(process.cwd(), 'app/gallery/page.tsx');

describe('the creative set names industries that exist', () => {
  it('every creative key is a real industry', () => {
    // A typo here silently demotes a whole vertical into the "trades" band with no error.
    const keys = new Set(INDUSTRIES.map((i) => i.key as string));
    for (const k of CREATIVE_INDUSTRIES) expect(keys.has(k)).toBe(true);
  });

  it('covers the three verticals the work is aimed at', () => {
    for (const k of ['photography', 'author', 'personal']) {
      expect(CREATIVE_INDUSTRIES.has(k)).toBe(true);
    }
  });

  it('is a subset, not everything', () => {
    expect(CREATIVE_INDUSTRIES.size).toBeLessThan(INDUSTRIES.length);
    expect(PER_INDUSTRY).toBeGreaterThan(0);
  });
});

// ⚠️ SOURCE GUARDS. Each pins a decision that is invisible to a unit test and whose failure
// mode is a page that renders fine and says something false.
describe('the query cannot silently drop most of the fleet', () => {
  const raw = fs.readFileSync(LIB, 'utf8');
  // ⚠️ Comments stripped before matching, and the first version of this file FAILED for want
  // of it: the `is_version` assertion was tripped by the comment explaining why there is no
  // `is_version` filter. That is precisely the ROUTER_STRATEGY.md failure (§9) — a corrected
  // document trips a mentions-it check by explaining its own correction — reproduced inside
  // the test that cites it.
  const src = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('never filters on is_version', () => {
    // ⚠️ `getShowcaseData` carries this filter with a standing comment that it "silently drops
    // most of the fleet", harmless there only because the curated homepage slugs happen to
    // survive it. `personal` has 6 published sites and 2 would survive. The identical filter
    // once cut the public restaurant directory to one placeholder.
    expect(src).not.toMatch(/is_version/);
  });

  it('pages past the PostgREST 1000-row cap', () => {
    // A capped read looks exactly like a small fleet.
    expect(src).toMatch(/\.range\(from, from \+ 999\)/);
  });

  it('excludes demos dressed as customers', () => {
    expect(src).toMatch(/looksLikeDemo/);
  });

  it('links to the platform URL, not a custom domain', () => {
    // A domain can lapse or be re-pointed while the template stays published; a gallery full
    // of dead links is worse than a plain one.
    expect(src).toMatch(/href: `\/sites\/\$\{r\.slug\}`/);
  });

  it('reports industries with no example instead of hiding them', () => {
    // Silently omitting what it cannot show reads as complete coverage.
    expect(src).toMatch(/missing\.push/);
  });
});

describe('the page does not claim these are customers', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  const prose = page.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('never calls them clients or customers', () => {
    // ⚠️ 31 published towing sites are unclaimed geo pitch sites nobody pays for, several
    // naming businesses that do not exist. Showing them as our work is honest; calling them
    // clients is a false claim about our book. Comments are stripped first so the rule cannot
    // be tripped by a comment explaining the rule (the ROUTER_STRATEGY.md lesson, §9).
    expect(prose).not.toMatch(/\b(our customers|our clients|trusted by|clients include)\b/i);
  });

  it('says plainly that some were built to demonstrate the tool', () => {
    expect(prose).toMatch(/some we built to show what the tool does/i);
  });

  it('uses semantic colour tokens only', () => {
    // The app chrome is always dark; a literal light utility renders dark-on-dark (§7).
    expect(prose).not.toMatch(
      /text-zinc-(700|800|900)|bg-white(\b[^/-]|$)|border-zinc-(200|300)|bg-(zinc|slate|gray)-(50|100)(\b[^/-]|$)/,
    );
  });

  it('gives every thumbnail real alt text', () => {
    expect(prose).toMatch(/alt=\{`\$\{e\.name\} — \$\{g\.label\}/);
  });

  it('is reading files that exist and are non-trivial', () => {
    expect(page.length).toBeGreaterThan(1500);
    expect(fs.readFileSync(LIB, 'utf8').length).toBeGreaterThan(2000);
  });

  it('the comment-stripping the guards rely on actually removes comments', () => {
    // A stripper that silently returned the input would make every `not.toMatch` above pass
    // for the wrong reason — the "a sweep matching nothing reports success" shape.
    const stripped = '// is_version\nconst a = 1;'.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/is_version/);
    expect(stripped).toMatch(/const a = 1;/);
  });
});
