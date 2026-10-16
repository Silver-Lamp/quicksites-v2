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
});
