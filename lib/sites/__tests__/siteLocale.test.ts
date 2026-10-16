/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { CHROME_STRING_KEYS, CHROME_STRING_KEYS_IT, SITE_LOCALE_ATTR, chromeStrings, siteLocale } from '@/lib/sites/siteLocale';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('siteLocale', () => {
  it('reads meta.locale, then meta.booking.locale; anything else is English', () => {
    expect(siteLocale({ data: { meta: { locale: 'it' } } })).toBe('it');
    expect(siteLocale({ meta: { booking: { locale: 'it' } } })).toBe('it');
    expect(siteLocale({ data: { meta: { locale: 'it-IT' } } })).toBe('it');
    expect(siteLocale({ data: { meta: {} } })).toBe('en');
    expect(siteLocale({ data: { meta: { locale: 'de' } } })).toBe('en');
    expect(siteLocale(null)).toBe('en');
  });
  it('the two chrome string tables carry the same keys', () => {
    expect([...CHROME_STRING_KEYS_IT].sort()).toEqual([...CHROME_STRING_KEYS].sort());
    expect(chromeStrings('it').quickLinks).not.toBe(chromeStrings('en').quickLinks);
    expect(chromeStrings('xx').findUs).toBe('Find Us');
  });
});

describe('the chrome around a site speaks its language', () => {
  it('the renderer stamps the locale on its root', () => {
    const src = read('components/sites/site-renderer.tsx');
    expect(src).toMatch(/lang=\{siteLocale\(site\)\}/);
    expect(src).toMatch(/SITE_LOCALE_ATTR/);
    expect(SITE_LOCALE_ATTR).toBe('data-qs-locale');
  });
  it('the footer has no literal English column headings', () => {
    const src = read('components/admin/templates/render-blocks/footer.tsx');
    expect(src).toMatch(/chromeStrings\(siteLocale\(template\)\)/);
    for (const literal of ['>Quick Links<', '>Company Info<', "'Find Us'", "'Elsewhere'", '>Business<', '>Phone<']) expect(src).not.toContain(literal);
  });
  it('the Hear-this-page pill reads the stamp, hides while a field is focused, and is icon-only on a phone', () => {
    const src = read('components/hear-this-page.tsx');
    expect(src).toMatch(/getAttribute\(SITE_LOCALE_ATTR\)/);
    expect(src).toMatch(/addEventListener\('focusin'/);
    expect(src).toMatch(/fieldFocused && !open\) return null/);
    expect(src).toMatch(/if \(siteOff !== false\) return null/); // nothing renders until the mount check has run (no flash on opted-out sites)
    expect(src).toMatch(/className="hidden sm:inline">\{cs\.hearThisPage\}/);
    expect(src).not.toMatch(/>\s*Hear this page\s*</);
  });
  // HJ's re-run (2026-10-16): four small things were still English or in the way.
  it('the pill reads the locale AT MOUNT (not only in the 1.5 s detect pass) and hides while anything inside a form has focus (time chips are buttons)', () => {
    const src = read('components/hear-this-page.tsx');
    const mountRead = src.indexOf('setLocale(document.querySelector(`[${SITE_LOCALE_ATTR}]`)');
    const detect = src.indexOf('const detect = () =>');
    expect(mountRead).toBeGreaterThan(-1);
    expect(mountRead).toBeLessThan(detect);
    expect(src).toMatch(/closest\?\.\('form'\)/);
    expect(src).toMatch(/if \(inForm\(e\.target as Element\)\) setFieldFocused\(true\)/);
  });
  it('the document language follows the site on both public routes', () => {
    expect(read('components/sites/site-theme-setter.tsx')).toMatch(/document\.documentElement\.lang = lang/);
    expect(read('components/sites/site-lang-setter.tsx')).toMatch(/document\.documentElement\.lang = lang/);
    const host = read('app/host/[[...rest]]/page.tsx');
    expect(host).toMatch(/<SiteThemeSetter mode=\{colorMode\} lang=\{siteLang\} \/>/);
    expect(host).toMatch(/h\.lang='\$\{siteLang\}'/); // before paint, in the inline script
    expect(read('app/sites/[slug]/[[...rest]]/page.tsx')).toMatch(/<SiteLangSetter lang=\{siteLang\} \/>/);
  });
  it('the contact form draws its chrome from the site locale and links every label to its input', () => {
    const src = read('components/admin/templates/render-blocks/contact-form.tsx');
    expect(src).toMatch(/chromeStrings\(siteLocale\(/);
    for (const literal of ['>Name:<', '>Email:<', '>Phone Number:<', "'Submit'", "'Submitting...'", 'Or call us at{', 'Thank you! Your submission']) expect(src).not.toContain(literal);
    for (const id of ['contact-name', 'contact-email', 'contact-phone']) {
      expect(src).toContain(`htmlFor="${id}"`);
      expect(src).toContain(`id="${id}"`);
    }
    const it = chromeStrings('it');
    expect(it.name).toBe('Nome');
    expect(it.submit).toBe('Invia');
  });
});
