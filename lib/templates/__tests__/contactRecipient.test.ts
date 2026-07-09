// lib/templates/__tests__/contactRecipient.test.ts
import { pickContactEmail, isEmail } from '../contactRecipient';

describe('isEmail', () => {
  it('accepts well-formed addresses and rejects junk', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail(' a@b.co ')).toBe(true); // trimmed
    expect(isEmail('nope')).toBe(false);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail(null)).toBe(false);
    expect(isEmail(123 as any)).toBe(false);
  });
});

describe('pickContactEmail', () => {
  it('prefers the top-level contact_email column', () => {
    expect(pickContactEmail({ contact_email: 'Owner@Biz.com' })).toBe('owner@biz.com');
  });

  it('falls back through the nested meta/contact paths', () => {
    expect(pickContactEmail({ data: { meta: { contact_email: 'a@x.com' } } })).toBe('a@x.com');
    expect(pickContactEmail({ data: { meta: { contact: { email: 'b@x.com' } } } })).toBe('b@x.com');
    expect(pickContactEmail({ data: { contact: { email: 'c@x.com' } } })).toBe('c@x.com');
    expect(
      pickContactEmail({ data: { meta: { identity: { contact: { email: 'd@x.com' } } } } })
    ).toBe('d@x.com');
  });

  it('uses column over nested when both present', () => {
    const row = { contact_email: 'top@x.com', data: { meta: { contact: { email: 'nested@x.com' } } } };
    expect(pickContactEmail(row)).toBe('top@x.com');
  });

  it('returns null for missing / malformed / empty', () => {
    expect(pickContactEmail(null)).toBeNull();
    expect(pickContactEmail({})).toBeNull();
    expect(pickContactEmail({ contact_email: 'not-an-email' })).toBeNull();
    expect(pickContactEmail({ contact_email: '' })).toBeNull();
    expect(pickContactEmail({ data: { meta: { contact: { email: null } } } })).toBeNull();
  });
});
