import { SITE_MAP, filterSiteMap } from '../siteMap';

// The OFFLINE half of contracts/not-found-sitemap.md rule 2. Reachability needs a network
// call and lives in scripts/verify-sitemap-links.ts (run on a cadence); these are the
// invariants that can be checked for free on every commit, so a bad entry never reaches the
// point where only a scheduled job would catch it.
describe('site map integrity', () => {
  const links = SITE_MAP.flatMap((g) => g.links);

  it('has no duplicate hrefs', () => {
    const seen = new Map<string, string[]>();
    for (const l of links) seen.set(l.href, [...(seen.get(l.href) ?? []), l.label]);
    const dupes = [...seen.entries()].filter(([, labels]) => labels.length > 1);
    expect(dupes).toEqual([]);
  });

  it('is all internal, root-relative paths', () => {
    for (const l of links) {
      expect(l.href.startsWith('/')).toBe(true);
      expect(l.href).not.toMatch(/^\/\//); // protocol-relative would leave the site
      expect(l.href).not.toContain('://');
    }
  });

  // These are documented in siteMap.ts as deliberate exclusions. A test keeps the omission a
  // choice: without it, someone "helpfully" adds a gated page to the most-crawled page we have.
  it('never links a gated, unlisted or authenticated surface', () => {
    const forbidden = [/^\/admin/, /^\/merchant/, /^\/dashboard/, /^\/profile/, /^\/for-/, /^\/personas/, /^\/secondset/];
    for (const l of links) {
      for (const pattern of forbidden) {
        expect(l.href).not.toMatch(pattern);
      }
    }
  });

  it('every group has a title and at least one link', () => {
    for (const g of SITE_MAP) {
      expect(g.title.trim().length).toBeGreaterThan(0);
      expect(g.links.length).toBeGreaterThan(0);
    }
  });

  it('every link has a human label', () => {
    for (const l of links) expect(l.label.trim().length).toBeGreaterThan(0);
  });

  it('filters across label, blurb, href and group', () => {
    expect(filterSiteMap(SITE_MAP, 'delivered').flatMap((g) => g.links)).toHaveLength(1);
    // "menu" appears only in delivered.menu's blurb — proves blurbs are searched.
    expect(filterSiteMap(SITE_MAP, 'menu').flatMap((g) => g.links).length).toBeGreaterThan(0);
    expect(filterSiteMap(SITE_MAP, 'zzzzznope')).toEqual([]);
  });
});
