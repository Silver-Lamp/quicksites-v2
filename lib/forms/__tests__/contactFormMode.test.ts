// lib/forms/__tests__/contactFormMode.test.ts — the email-only contact form asks for ONE thing.
import fs from 'node:fs';
import path from 'node:path';
import { contactFormMode, emailOnlyCopy, validateEmailOnly } from '@/lib/forms/contactFormMode';
import { chromeStrings } from '@/lib/sites/siteLocale';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const en = chromeStrings('en');
const itStr = chromeStrings('it');

describe('contactFormMode', () => {
  it('defaults to full; only the exact value switches', () => {
    expect(contactFormMode({})).toBe('full');
    expect(contactFormMode(null)).toBe('full');
    expect(contactFormMode({ mode: 'email' })).toBe('full');
    expect(contactFormMode({ mode: 'email_only' })).toBe('email_only');
  });
  it('copy: owner text first, the site-language string as the fallback', () => {
    expect(emailOnlyCopy({}, en)).toEqual({ description: '', placeholder: 'you@example.com', buttonText: 'Notify me', successMessage: 'Thanks — you’re on the list.', note: '' });
    expect(emailOnlyCopy({ button_text: ' Tell me ', note: 'Only for this.' }, en)).toMatchObject({ buttonText: 'Tell me', note: 'Only for this.' });
    expect(emailOnlyCopy({}, itStr).buttonText).toBe('Avvisami');
  });
  it('validation: required, then shape', () => {
    expect(validateEmailOnly('', en)).toBe(en.emailRequired);
    expect(validateEmailOnly('nope', en)).toBe(en.emailInvalid);
    expect(validateEmailOnly('a@b.co', en)).toBeNull();
    expect(validateEmailOnly('', itStr)).toBe('Inserisci la tua email.');
  });
});

describe('the wiring (source guards)', () => {
  const src = read('components/admin/templates/render-blocks/contact-form.tsx');
  const emailOnlyBranch = src.slice(src.indexOf('if (emailOnly) {\n    // ⚠️ ONE field'), src.indexOf('\n  return (\n    <section id={anchorId} data-contact-anchor>'));
  it('the email-only branch renders exactly one input, of type email, and no name/phone/select', () => {
    expect(emailOnlyBranch.length).toBeGreaterThan(200);
    expect(emailOnlyBranch.match(/<input/g)?.length).toBe(1);
    expect(emailOnlyBranch).toMatch(/type="email"/);
    expect(emailOnlyBranch).not.toMatch(/name="name"|name="phone"|<select/);
    expect(emailOnlyBranch).toMatch(/data-contact-mode="email_only"/);
    expect(emailOnlyBranch).toMatch(/role="status" aria-live="polite"/);
  });
  it('validation in email-only mode is the pure helper, and the full form keeps its own', () => {
    expect(src).toMatch(/if \(emailOnly\) \{\s*const emailErr = validateEmailOnly\(formData\.email, cs\)/);
    expect(src).toMatch(/if \(!formData\.name\) nextErrors\.name = cs\.nameRequired/);
  });
  it('the editor offers the toggle and saves the mode only when on', () => {
    const ed = read('components/admin/templates/block-editors/contact-form-editor.tsx');
    expect(ed).toMatch(/Email only \(simplified\)/);
    expect(ed).toMatch(/\.\.\.\(emailOnly\s*\?\s*\{\s*mode: 'email_only'/);
  });
});
