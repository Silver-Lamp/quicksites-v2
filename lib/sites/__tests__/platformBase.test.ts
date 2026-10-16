/**
 * @jest-environment node
 */
import { platformBaseFromPathname, rebaseSiteHref } from '@/lib/sites/platformBase';

describe('platformBaseFromPathname', () => {
  it('finds /sites/<slug> and nothing else', () => {
    expect(platformBaseFromPathname('/sites/bhard')).toBe('/sites/bhard');
    expect(platformBaseFromPathname('/sites/bhard/menu?x=1')).toBe('/sites/bhard');
    expect(platformBaseFromPathname('/')).toBe('');
    expect(platformBaseFromPathname('/admin/templates/abc')).toBe('');
    expect(platformBaseFromPathname('/menu')).toBe(''); // a custom domain's own path
    expect(platformBaseFromPathname(null)).toBe('');
  });
});

describe('rebaseSiteHref — at /sites/<slug> a root-relative link stays on the site', () => {
  const base = '/sites/bhard';
  it('rewrites root-relative hrefs', () => {
    expect(rebaseSiteHref('/', base)).toBe('/sites/bhard');
    expect(rebaseSiteHref('/#contact', base)).toBe('/sites/bhard#contact');
    expect(rebaseSiteHref('/menu', base)).toBe('/sites/bhard/menu');
  });
  it('leaves hashes, mailto/tel, absolute URLs, protocol-relative and already-based hrefs alone', () => {
    for (const h of ['#contact', 'mailto:a@b.c', 'tel:+1', 'https://x.test/', '//cdn.x/y', '/sites/bhard/menu', '/sites/bhard']) expect(rebaseSiteHref(h, base)).toBe(h);
  });
  it('does nothing without a base (custom domain, subdomain, editor)', () => {
    expect(rebaseSiteHref('/', '')).toBe('/');
    expect(rebaseSiteHref('/#contact', '')).toBe('/#contact');
  });
});
