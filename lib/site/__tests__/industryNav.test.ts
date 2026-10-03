/**
 * @jest-environment node
 */
// lib/site/__tests__/industryNav.test.ts
//
// One list of industries for the homepage pills and the nav dropdown, ending in a derived
// "+N more" that opens the gallery. The source guards exist because the defect was two
// hand-typed lists on one page: a test of either list in isolation passes while they disagree.
import fs from 'node:fs';
import path from 'node:path';
import { INDUSTRIES } from '@/lib/industries';
import { GALLERY_HREF, INDUSTRY_NAV, galleryHrefFor, moreIndustriesCount, moreIndustriesLabel } from '@/lib/site/industryNav';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('the industry list', () => {
  it('names real industries, each exactly once', () => {
    const keys = INDUSTRY_NAV.map((e) => e.key).filter(Boolean) as string[];
    const known = new Set(INDUSTRIES.map((i) => i.key));
    for (const k of keys) expect(known.has(k as any)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('derives "+N more" from lib/industries rather than typing it', () => {
    const keyed = INDUSTRY_NAV.filter((e) => e.key).length;
    expect(moreIndustriesCount()).toBe(INDUSTRIES.length - keyed);
    expect(moreIndustriesLabel()).toBe(`+${INDUSTRIES.length - keyed} more`);
    expect(moreIndustriesCount()).toBeGreaterThan(0);
  });

  it('every entry links to a page that exists', () => {
    for (const e of INDUSTRY_NAV) {
      const pathname = e.href.split('?')[0];
      const dir = pathname.replace(/^\//, '');
      const exists = fs.existsSync(path.join(process.cwd(), 'app', dir, 'page.tsx'));
      expect({ href: e.href, exists }).toEqual({ href: e.href, exists: true });
    }
    expect(fs.existsSync(path.join(process.cwd(), 'app', GALLERY_HREF.replace(/^\//, ''), 'page.tsx'))).toBe(true);
    expect(galleryHrefFor('plumbing')).toBe('/gallery?industry=plumbing');
  });

  it('keeps the two verticals that have no industry key but earn their door', () => {
    expect(INDUSTRY_NAV.find((e) => e.href === '/verbatim')).toBeTruthy();
    expect(INDUSTRY_NAV.find((e) => e.href === '/supplements')).toBeTruthy();
  });
});

describe('both surfaces render the one list', () => {
  it('the homepage pills come from INDUSTRY_NAV and end with the gallery', () => {
    const src = read('components/home/home-client.tsx');
    expect(src).toMatch(/INDUSTRY_NAV\.map\(/);
    expect(src).toMatch(/moreIndustriesLabel\(\)/);
    expect(src).toMatch(/href=\{GALLERY_HREF\}/);
    expect(src).not.toMatch(/INDUSTRY_PILLS/);
  });

  it('the nav dropdown comes from INDUSTRY_NAV and ends with the gallery', () => {
    const src = read('components/site/site-header.tsx');
    expect(src).toMatch(/\.\.\.INDUSTRY_NAV\.map\(/);
    expect(src).toMatch(/label: moreIndustriesLabel\(\), href: GALLERY_HREF/);
    // No hand-typed vertical list left behind.
    expect(src).not.toMatch(/\{ label: 'Restaurants', href: '\/restaurants' \}/);
  });

  it('the gallery is one flowing board with the industry filter the entries link to', () => {
    const src = read('app/gallery/page.tsx');
    expect(src).toMatch(/columns-1 gap-4 sm:columns-2/);
    expect(src).toMatch(/break-inside-avoid/);
    expect(src).toMatch(/getGalleryData\(\{ industry: only \}\)/);
  });
});
