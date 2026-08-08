import {
  absoluteUrl,
  publicPathFor,
  sitePagePath,
  siteSlugFromHost,
  stripHomeSegment,
} from '../canonicalUrl';

describe('publicPathFor', () => {
  it('uses the requested path when middleware supplied it', () => {
    expect(publicPathFor({ headerPath: '/', slug: 'graftontowing' })).toBe('/');
    expect(publicPathFor({ headerPath: '/services', slug: 'graftontowing' })).toBe('/services');
  });

  it('ignores the routed segments entirely when the real path is known', () => {
    // The rewrite target is /sites/graftontowing/home; the visitor typed "/".
    expect(publicPathFor({ headerPath: '/', slug: 'graftontowing', rest: ['home'] })).toBe('/');
  });

  it('falls back to the routed path for a direct platform-host hit', () => {
    expect(publicPathFor({ headerPath: null, slug: 'local' })).toBe('/sites/local');
    expect(publicPathFor({ headerPath: '', slug: 'local', rest: ['about'] })).toBe(
      '/sites/local/about',
    );
  });

  it('normalises a trailing slash so one page is not two canonicals', () => {
    expect(publicPathFor({ headerPath: '/services/', slug: 'x' })).toBe('/services');
  });
});

describe('stripHomeSegment', () => {
  // ⚠️ Regression: middleware rewrites a bare tenant root to /sites/<slug>/home, so the home page
  // arrives carrying a page slug it never had in the URL.
  it('drops the injected home segment', () => {
    expect(stripHomeSegment(['home'])).toEqual([]);
  });

  it('keeps a real page called home-something, and keeps deeper paths', () => {
    expect(stripHomeSegment(['home-services'])).toEqual(['home-services']);
    expect(stripHomeSegment(['home', 'x'])).toEqual(['home', 'x']);
  });
});

describe('absoluteUrl', () => {
  it('builds the visitor URL, not the routing path', () => {
    expect(absoluteUrl('https://www.graftontowing.com', '/')).toBe('https://www.graftontowing.com/');
    expect(absoluteUrl('https://www.graftontowing.com/', '/services')).toBe(
      'https://www.graftontowing.com/services',
    );
  });

  // The exact string that was live on every published site.
  it('never produces the /sites/home shape', () => {
    const url = absoluteUrl(
      'https://sandon.quicksites.ai',
      publicPathFor({ headerPath: '/', slug: 'sandon', rest: stripHomeSegment(['home']) }),
    );
    expect(url).toBe('https://sandon.quicksites.ai/');
    expect(url).not.toContain('/sites/');
  });
});

describe('siteSlugFromHost', () => {
  it('reads the slug off a platform subdomain', () => {
    expect(siteSlugFromHost('sandon.quicksites.ai')).toBe('sandon');
    expect(siteSlugFromHost('Sandon.QuickSites.ai')).toBe('sandon');
    expect(siteSlugFromHost('foo.cedarsites.com')).toBe('foo');
  });

  it('returns null for an apex, a reserved label, or a custom domain', () => {
    expect(siteSlugFromHost('quicksites.ai')).toBeNull();
    expect(siteSlugFromHost('www.quicksites.ai')).toBeNull();
    expect(siteSlugFromHost('app.quicksites.ai')).toBeNull();
    expect(siteSlugFromHost('www.graftontowing.com')).toBeNull();
  });
});

describe('sitePagePath', () => {
  it('maps the home page to the root, not /home', () => {
    expect(sitePagePath('home')).toBe('/');
    expect(sitePagePath('')).toBe('/');
    expect(sitePagePath(null)).toBe('/');
  });

  // Regression: a real site's only page is slugged `index`, which a home-only rule published as
  // https://.../index — the same page at a second address.
  it('treats index as the root too', () => {
    expect(sitePagePath('index')).toBe('/');
    expect(sitePagePath('Index')).toBe('/');
  });

  it('treats the first page as the root whatever it is called', () => {
    expect(sitePagePath('welcome', { isFirstPage: true })).toBe('/');
    expect(sitePagePath('welcome')).toBe('/welcome');
  });

  it('maps any other page to its own path', () => {
    expect(sitePagePath('services')).toBe('/services');
    expect(sitePagePath('/services/')).toBe('/services');
  });
});
