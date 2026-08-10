import { buildPageTitle, isGenericPageTitle } from '../pageTitle';

describe('isGenericPageTitle', () => {
  it('recognises the names the builder assigns by default', () => {
    for (const t of ['Home', 'home', ' INDEX ', 'Untitled', 'New Page', '']) {
      expect(isGenericPageTitle(t)).toBe(true);
    }
  });

  it('leaves a real page name alone', () => {
    expect(isGenericPageTitle('Emergency Towing')).toBe(false);
    expect(isGenericPageTitle('Home Services')).toBe(false); // not the bare word
  });
});

describe('buildPageTitle', () => {
  // The live bug: graftontowing.com and renton-restaurant both served <title>Home</title>.
  it('does not let the placeholder page name win over the business', () => {
    expect(
      buildPageTitle({
        pageTitle: 'Home',
        siteName: 'Grafton Towing',
        city: 'Grafton',
        region: 'MA',
        isHomePage: true,
      }),
    ).toBe('Grafton Towing — Grafton, MA');
  });

  it('keeps a page name the owner actually chose', () => {
    expect(
      buildPageTitle({ pageTitle: 'Emergency Towing — Grafton MA', siteName: 'Grafton Towing' }),
    ).toBe('Emergency Towing — Grafton MA — Grafton Towing');
  });

  it('uses an explicit SEO title verbatim, ahead of everything', () => {
    expect(
      buildPageTitle({ seoTitle: '24/7 Towing in Grafton', pageTitle: 'Home', siteName: 'X' }),
    ).toBe('24/7 Towing in Grafton');
  });

  it('leads a subpage with its own name', () => {
    expect(buildPageTitle({ pageTitle: 'Services', siteName: 'Grafton Towing' })).toBe(
      'Services — Grafton Towing',
    );
  });

  it('omits the place when the owner never entered one', () => {
    expect(buildPageTitle({ pageTitle: 'Home', siteName: 'Grafton Towing', isHomePage: true })).toBe(
      'Grafton Towing',
    );
  });

  it('adds only the city when there is no region', () => {
    expect(
      buildPageTitle({ pageTitle: 'Home', siteName: 'Ocha Thai', city: 'Renton', isHomePage: true }),
    ).toBe('Ocha Thai — Renton');
  });

  // ⚠️ Nothing is invented: with no owner-supplied name the title stays weak rather than guessing.
  it('falls back to the page name rather than fabricating one', () => {
    expect(buildPageTitle({ pageTitle: 'Home', isHomePage: true })).toBe('Home');
    expect(buildPageTitle({})).toBe('QuickSites');
  });
});
