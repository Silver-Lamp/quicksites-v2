/**
 * A FORMATTER THAT CANNOT PARSE ITS INPUT MUST SHOW THE INPUT, NOT INVENT DIGITS.
 *
 * ⚠️ `contact-form.tsx` formatted with `.replace(/\D/g,'').slice(0, 10)`, which TRUNCATES rather
 * than strips a country code. The E.164 `+12536552016` became `1253655201` and rendered as
 * **"(125) 365-5201"** — live on southhilltowing.com the hour a real tracking number was put on
 * it. The `tel:` href used the full digits and worked, so tapping was fine and READING was
 * wrong: a failure that survives every click test and only hurts the person who dials by hand.
 *
 * `hero.tsx` and `footer.tsx` returned the raw input on a non-10-digit value — ugly, and true.
 * That difference is why this is one module now.
 */
import { formatUsPhone, telHref } from '../formatUs';
import { readFileSync } from 'fs';
import { join } from 'path';
// ⚠️ Strip comments BEFORE matching. The note in contact-form.tsx explaining this very fix
// quotes `.slice(0, 10)`, so a naive grep fails on the comment that documents the repair —
// the trap CLAUDE.md §4 describes and that bit this repo repeatedly.
import { stripComments } from '@/test/stripComments';

describe('formatUsPhone', () => {
  it('strips a leading US country code instead of truncating', () => {
    expect(formatUsPhone('+12536552016')).toBe('(253) 655-2016');
    expect(formatUsPhone('12536552016')).toBe('(253) 655-2016');
    expect(formatUsPhone('+12536552016')).not.toBe('(125) 365-5201');
  });

  it('formats a plain 10-digit number', () => {
    expect(formatUsPhone('2536552016')).toBe('(253) 655-2016');
    expect(formatUsPhone('253.655.2016')).toBe('(253) 655-2016');
  });

  it('is idempotent on an already-formatted number', () => {
    expect(formatUsPhone('(253) 655-2016')).toBe('(253) 655-2016');
  });

  it('returns the INPUT unchanged when it cannot parse — never a partial number', () => {
    // Showing "+442071234567" is honest. Showing "(442) 071-2345" is a wrong number.
    for (const bad of ['+442071234567', '555', 'call us', '', '12345678901234']) {
      expect(formatUsPhone(bad)).toBe(bad);
    }
  });

  it('handles null and undefined without throwing', () => {
    expect(formatUsPhone(null)).toBe('');
    expect(formatUsPhone(undefined)).toBe('');
  });
});

describe('telHref', () => {
  it('returns a COMPLETE href, scheme included', () => {
    // ⚠️ It once returned bare digits while being named telHref, and the caller wrote
    // href={telHref(raw)} — shipping <a href="+12536552016">, which a browser treats as a
    // relative path. Tap-to-call silently dead on a towing site.
    expect(telHref('+12536552016')).toBe('tel:+12536552016');
    expect(telHref('(253) 655-2016')).toBe('tel:+12536552016');
    expect(telHref('2536552016')).toBe('tel:+12536552016');
  });

  it('always starts with the scheme when there is anything to dial', () => {
    for (const raw of ['2536552016', '+12536552016', '(253) 655-2016', '5551234']) {
      expect(telHref(raw).startsWith('tel:')).toBe(true);
    }
  });

  it('agrees with the display form on the same input', () => {
    // The text and the link drifting apart is what let the original bug survive a click test.
    const raw = '+12536552016';
    expect(telHref(raw)).toContain(formatUsPhone(raw).replace(/\D/g, ''));
  });

  it('no caller has to add the scheme itself', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const src = readFileSync(
      join(process.cwd(), 'components/admin/templates/render-blocks/contact-form.tsx'),
      'utf8',
    );
    // `href={`tel:${telHref(...)}`}` would double the scheme.
    expect(src).not.toMatch(/tel:\$\{telHref/);
  });

  it('is empty for no input rather than a bare "tel:"', () => {
    expect(telHref('')).toBe('');
    expect(telHref(null)).toBe('');
  });
});

describe('the renderers all use it', () => {
  const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
  const RENDERERS = [
    'components/admin/templates/render-blocks/contact-form.tsx',
    'components/admin/templates/render-blocks/footer.tsx',
    'components/admin/templates/render-blocks/hero.tsx',
  ];

  it.each(RENDERERS)('%s imports the shared formatter', (p) => {
    expect(read(p)).toContain("from '@/lib/phone/formatUs'");
  });

  it('no renderer still truncates to ten digits', () => {
    for (const p of RENDERERS) {
      const src = read(p);
      // Guard the guard: a stripper that returned '' would make this pass on anything.
      expect(src.length).toBeGreaterThan(500);
      expect(src).not.toMatch(/\.slice\(0,\s*10\)/);
    }
  });
});
