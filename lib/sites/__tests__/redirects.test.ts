/**
 * @jest-environment node
 */
// lib/sites/__tests__/redirects.test.ts
//
// An unknown path on a public site used to render the home page with a 200 (Google indexed
// decatur-towing.com/gigs). Now: redirect → page → reserved → 404, decided here, purely.

import { normalizePath, parseSiteRedirects, matchRedirect, resolvePublicPath, RESERVED_FIRST_SEGMENTS } from '@/lib/sites/redirects';

describe('normalizePath', () => {
  it('lowercases, strips query/hash and trailing slashes, collapses slashes', () => {
    expect(normalizePath('/Practice-Areas/DUI/?utm=1#x')).toBe('/practice-areas/dui');
    expect(normalizePath('practice-areas//dui')).toBe('/practice-areas/dui');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
});

describe('parseSiteRedirects', () => {
  it('normalises from, keeps absolute to, defaults permanent, drops junk and self-loops', () => {
    const r = parseSiteRedirects([
      { from: '/Practice-Areas/Personal-Injury/', to: '/civil-litigation' },
      { from: '/dui', to: 'https://example.com/elsewhere', permanent: false },
      { from: '/', to: '/x' }, // root never redirects
      { from: '/loop', to: '/loop/' }, // self
      { from: 42, to: '/x' },
      'nope',
      { from: '/dup', to: '/a' },
      { from: '/dup/', to: '/b' }, // duplicate after normalisation → first wins
    ]);
    expect(r).toEqual([
      { from: '/practice-areas/personal-injury', to: '/civil-litigation', permanent: true },
      { from: '/dui', to: 'https://example.com/elsewhere', permanent: false },
      { from: '/dup', to: '/a', permanent: true },
    ]);
  });
  it('returns [] for anything that is not a list', () => {
    expect(parseSiteRedirects(undefined)).toEqual([]);
    expect(parseSiteRedirects({})).toEqual([]);
  });
});

describe('matchRedirect', () => {
  const rs = parseSiteRedirects([{ from: '/old-page', to: '/new-page' }]);
  it('matches case- and slash-insensitively', () => {
    expect(matchRedirect(rs, '/Old-Page/')?.to).toBe('/new-page');
    expect(matchRedirect(rs, '/other')).toBeNull();
  });
});

const site = {
  pages: [{ slug: 'home' }, { slug: 'civil-litigation' }, { slug: 'contact', id: 'p3' }],
  data: {
    meta: {
      redirects: [
        { from: '/practice-areas/personal-injury/', to: '/civil-litigation' },
        { from: '/index.php', to: '/' },
        { from: '/contact', to: '/civil-litigation' }, // a redirect beats a page of the same name
      ],
    },
  },
};

describe('resolvePublicPath', () => {
  it('root and /home resolve to the first page', () => {
    expect(resolvePublicPath(site, [])).toEqual({ kind: 'page', slug: 'home' });
    expect(resolvePublicPath(site, ['home'])).toEqual({ kind: 'page', slug: 'home' });
    expect(resolvePublicPath(site, undefined)).toEqual({ kind: 'page', slug: 'home' });
  });
  it('a known page slug (or id) resolves to that page, case-insensitively', () => {
    expect(resolvePublicPath(site, ['Civil-Litigation'])).toEqual({ kind: 'page', slug: 'civil-litigation' });
    expect(resolvePublicPath(site, ['p3'])).toEqual({ kind: 'page', slug: 'contact' });
  });
  it('an old multi-segment URL with a redirect is redirected (308 by default)', () => {
    expect(resolvePublicPath(site, ['practice-areas', 'personal-injury'])).toEqual({ kind: 'redirect', to: '/civil-litigation', permanent: true });
    expect(resolvePublicPath(site, ['index.php'])).toEqual({ kind: 'redirect', to: '/', permanent: true });
  });
  it('a redirect wins over a page of the same path', () => {
    expect(resolvePublicPath(site, ['contact'])).toEqual({ kind: 'redirect', to: '/civil-litigation', permanent: true });
  });
  it('reserved app paths are left alone', () => {
    for (const seg of ['cart', 'checkout', 'thank-you', 'p', 'sitemap.xml']) {
      expect(resolvePublicPath(site, [seg, 'x'])).toEqual({ kind: 'reserved', segment: seg });
      expect(RESERVED_FIRST_SEGMENTS.has(seg)).toBe(true);
    }
  });
  it('anything else is a 404 — never the home page', () => {
    expect(resolvePublicPath(site, ['gigs'])).toEqual({ kind: 'not_found', path: '/gigs' });
    expect(resolvePublicPath(site, ['wp-content', 'uploads', 'x.jpg'])).toEqual({ kind: 'not_found', path: '/wp-content/uploads/x.jpg' });
    expect(resolvePublicPath(site, ['this-path-does-not-exist-xyz'])).toMatchObject({ kind: 'not_found' });
  });
  it('a site with no redirects still 404s unknown paths and serves known ones', () => {
    const bare = { pages: [{ slug: 'home' }, { slug: 'menu' }] };
    expect(resolvePublicPath(bare, ['menu'])).toEqual({ kind: 'page', slug: 'menu' });
    expect(resolvePublicPath(bare, ['nope'])).toMatchObject({ kind: 'not_found' });
  });
  it('a broken redirects value never breaks resolution', () => {
    expect(resolvePublicPath({ pages: [{ slug: 'home' }], data: { meta: { redirects: 'garbage' as any } } }, ['home'])).toEqual({ kind: 'page', slug: 'home' });
  });
});
