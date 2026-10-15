/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  callingCodeOf,
  formatPhoneInput,
  phoneMaxLength,
  phonePlaceholder,
  phoneRegionForSite,
  phoneValidationError,
} from '@/lib/phone/region';
import { formatUsPhone } from '@/lib/phone/formatUs';
import { stripComments } from '@/test/stripComments';

describe('phoneRegionForSite — the site decides which phone format its visitor is asked for', () => {
  it('defaults to US when the site says nothing', () => {
    expect(phoneRegionForSite({ data: { meta: {} } })).toEqual({ kind: 'us' });
    expect(phoneRegionForSite({ data: { meta: { contact: { phone: '(253) 655-2016' } } } })).toEqual({ kind: 'us' });
    expect(phoneRegionForSite({ phone: '+12536552016' })).toEqual({ kind: 'us' });
    expect(phoneRegionForSite(null)).toEqual({ kind: 'us' });
  });

  it('the Italian demo: booking locale `it` → Italy, before the phone is even read', () => {
    const r = phoneRegionForSite({ data: { meta: { booking: { locale: 'it' }, contact: { phone: '+39 0577 000000' } } } });
    expect(r).toEqual({ kind: 'intl', callingCode: '39', country: 'IT' });
  });

  it("the business's own +-prefixed phone decides when no locale does", () => {
    expect(phoneRegionForSite({ data: { meta: { contact: { phone: '+44 20 7946 0000' } } } })).toEqual({ kind: 'intl', callingCode: '44', country: 'GB' });
    expect(phoneRegionForSite({ data: { meta: { contact: { phone: '0039 0577 000000' } } } })).toEqual({ kind: 'intl', callingCode: '39', country: 'IT' });
  });

  it('an explicit country wins over everything, and `en` alone implies no country', () => {
    expect(phoneRegionForSite({ data: { meta: { country: 'de', locale: 'it' } } })).toEqual({ kind: 'intl', callingCode: '49', country: 'DE' });
    expect(phoneRegionForSite({ data: { meta: { country: 'US', booking: { locale: 'it' } } } })).toEqual({ kind: 'us' });
    expect(phoneRegionForSite({ data: { meta: { locale: 'en' } } })).toEqual({ kind: 'us' });
  });

  it('callingCodeOf: longest known code first, so +353 is Ireland and not +35', () => {
    expect(callingCodeOf('+353 85 123 4567')).toBe('353');
    expect(callingCodeOf('+39 333 1234567')).toBe('39');
    expect(callingCodeOf('(253) 655-2016')).toBeNull();
  });
});

describe('placeholder, input shaping and validation per region', () => {
  const us = { kind: 'us' } as const;
  const italy = { kind: 'intl', callingCode: '39', country: 'IT' } as const;
  const unknown = { kind: 'intl', callingCode: '358', country: 'FI' } as const;

  it('placeholders are a recognisable local example, never "(555) 123-4567" abroad', () => {
    expect(phonePlaceholder(us)).toBe('(555) 123-4567');
    expect(phonePlaceholder(italy)).toBe('+39 333 123 4567');
    expect(phonePlaceholder(unknown)).toBe('+358 123 456 789');
  });

  it('US input is formatted to the US shape; international input is kept as typed', () => {
    expect(formatPhoneInput('2536552016', us, formatUsPhone)).toBe('(253) 655-2016');
    expect(formatPhoneInput('+39 0577 000000', italy, formatUsPhone)).toBe('+39 0577 000000');
    expect(formatPhoneInput('+39 0577 abc 000000', italy, formatUsPhone)).toBe('+39 0577  000000');
    expect(phoneMaxLength(italy)).toBeGreaterThan(phoneMaxLength(us));
    expect('+39 0577 000000'.length).toBeLessThanOrEqual(phoneMaxLength(italy));
  });

  it('validation: strict US shape at home, 7–15 digits with optional + abroad, empty is fine', () => {
    expect(phoneValidationError('', us)).toBeNull();
    expect(phoneValidationError('(253) 655-2016', us)).toBeNull();
    expect(phoneValidationError('253-655-2016', us)).toMatch(/10-digit/);
    expect(phoneValidationError('+39 0577 000000', italy)).toBeNull();
    expect(phoneValidationError('0577 000000', italy)).toBeNull();
    expect(phoneValidationError('+39 333 123 4567', italy)).toBeNull();
    expect(phoneValidationError('12345', italy)).toMatch(/country code, e\.g\. \+39 333 123 4567/);
    expect(phoneValidationError('+39 1234567890123456', italy)).not.toBeNull();
    expect(phoneValidationError('call me', italy)).not.toBeNull();
  });
});

describe('the contact form reads the region, never hard-codes the US', () => {
  const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'components/admin/templates/render-blocks/contact-form.tsx'), 'utf8'));
  it('no literal US placeholder, no US-only regex, no "US format" message, tel input mode', () => {
    expect(src).not.toMatch(/placeholder="\(555\) 123-4567"/);
    expect(src).not.toMatch(/\^\\\(\\d\{3\}\\\) \\d\{3\}-\\d\{4\}\$/);
    expect(src).not.toMatch(/US format/);
    expect(src).not.toMatch(/inputMode="numeric"/);
    expect(src).toMatch(/phoneRegionForSite\(t\)/);
    expect(src).toMatch(/phonePlaceholder\(phoneRegion\)/);
    expect(src).toMatch(/phoneValidationError\(formData\.phone, phoneRegion\)/);
    expect(src).toMatch(/formatPhoneInput\(e\.target\.value, phoneRegion, fmtPhone\)/);
  });
  it('the "Or call us at" line formats the raw phone, not its digits', () => {
    expect(src).toMatch(/fmtPhone\(phoneRaw\.trim\(\)\)/);
    expect(src).not.toMatch(/fmtPhone\(phoneDigits\)/);
  });
});
